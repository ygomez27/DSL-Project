from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_mysqldb import MySQL
from textx import metamodel_from_str, TextXSyntaxError
import logging
from contextlib import contextmanager

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type"]
    }
})

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# MySQL Configuration
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = '1234'
app.config['MYSQL_DB'] = 'workout_dsl'
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'

mysql = MySQL(app)

# Constants
VALID_EXERCISES = [
    "Lat Pulldown", "Bent-over Rows", "Deadlifts", "Squats", "Lunges",
    "Push-up", "Bench Press", "Incline Dumbbell Press", "Chest Flys",
    "Overhead Press", "Lateral Raises", "Bicep Curls", "Triceps Dips",
    "Burpees", "Dumbbell Row", "Leg Press"
]

VALID_GOAL_TYPES = ["Muscle Gain", "Fat Loss", "Strength", "Endurance"]
VALID_MUSCLES = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Full Body", "Dorsales"]
VALID_LEVELS = ["Beginner", "Intermediate", "Advanced"]

# DSL Grammar Definition
DSL_GRAMMAR = """

Program:
    (workout_definitions+=WorkoutDefinition | rule_definitions+=RuleDefinition)*
;

WorkoutDefinition:
    WorkoutDay MuscleGroup Goal Duration GenerateRoutine
;

WorkoutDay:
    'workout_day' day_of_week=DayOfWeek
;

DayOfWeek:
    "Monday" | "Tuesday" | "Wednesday" | "Thursday" 
    | "Friday" | "Saturday" | "Sunday"
;

MuscleGroup:
    'muscle_group' muscles+=Muscle (',' muscles+=Muscle)*
;

Muscle:
    "Chest" | "Back" | "Legs" | "Shoulders" 
    | "Arms" | "Core" | "Full Body" | "Dorsales"
;

Goal:
    'goal' goal_type=GoalType
;

GoalType:
    "Muscle Gain" | "Fat Loss" | "Strength" | "Endurance"
;

Duration:
    'duration' time=Time
;

Time:
    minutes=INT 'm'
;

GenerateRoutine:
    'generate_routine'
;

ExerciseDefinition:
    Exercise Sets Repetitions RestPeriod
;

Exercise:
    'exercise' name=ID
;

Sets:
    'sets' count=INT
;

Repetitions:
    'repetitions' count=INT
;

RestPeriod:
    'rest' time=Time
;

RuleDefinition:
    'rule' name=RuleName 'if' condition=Condition 'then' action=Action
;

RuleName:
    'Rule' number=INT
;

Condition:
    conditions+=ConditionExpr ('and' conditions+=ConditionExpr)*
;

ConditionExpr:
    variable=Variable operator=Operator value=Value
;

Variable:
    "muscle_group" | "goal" | "duration" | "age" | "fitness_level"
;

Operator:
    "==" | "!=" | "<" | ">" | "<=" | ">="
;

Value:
    STRING | INT | GoalType | Level
;

Level:
    "Beginner" | "Intermediate" | "Advanced"
;

Action:
    ExerciseAction | SetsRepsAction
;

ExerciseAction:
    'include_exercise' exercise=STRING
;

SetsRepsAction:
    'sets' sets_count=INT 'reps' reps_count=INT
;

RestTimeAction:
    'set_rest_time' 'min' min_time=Time 'max' max_time=Time
;
"""

metamodel = metamodel_from_str(DSL_GRAMMAR)


# Helper Functions
@contextmanager
def get_cursor():
    """Context manager for handling database cursors"""
    cur = None
    try:
        cur = mysql.connection.cursor()
        yield cur
        mysql.connection.commit()
    except Exception as e:
        mysql.connection.rollback()
        app.logger.error(f"Database error: {str(e)}")
        raise
    finally:
        if cur:
            cur.close()


def serialize_rule(rule_id):
    """Serialize a rule with its conditions and actions"""
    try:
        with get_cursor() as cur:
            # Get rule basics
            cur.execute("SELECT * FROM rules WHERE id = %s", (rule_id,))
            rule = cur.fetchone()
            if not rule:
                app.logger.warning(f"No rule found with ID {rule_id}")
                return None

            # Get conditions
            cur.execute("SELECT * FROM conditions WHERE rule_id = %s", (rule_id,))
            conditions = cur.fetchall()

            # Get actions
            cur.execute("SELECT * FROM actions WHERE rule_id = %s", (rule_id,))
            actions = cur.fetchall()

            return {
                'id': rule['id'],
                'name': rule['name'],
                'conditions': [dict(c) for c in conditions],
                'actions': [dict(a) for a in actions]
            }
    except Exception as e:
        app.logger.error(f"Error serializing rule {rule_id}: {str(e)}")
        return None


# Endpoints
@app.route('/analyze-grammar', methods=['GET'])
def analyze_grammar():
    """Endpoint to get grammar options for the frontend"""
    try:
        return jsonify({
            "variables": ["muscle_group", "goal", "duration", "age", "fitness_level"],
            "operators": ["==", "!=", "<", ">", "<=", ">="],
            "actions": ["include_exercise", "sets", "set_rest_time"],
            "exercise_names": VALID_EXERCISES,
            "goal_types": VALID_GOAL_TYPES,
            "levels": VALID_LEVELS,
            "muscles": VALID_MUSCLES,
            "customizable_sr": True
        })
    except Exception as e:
        app.logger.error(f"Grammar analysis error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/get-rules', methods=['GET'])
def get_rules():
    """Endpoint to fetch all rules"""
    try:
        with get_cursor() as cur:
            cur.execute("SELECT id FROM rules ORDER BY name")
            rule_ids = cur.fetchall()
            rules = []

            for row in rule_ids:
                rule_data = serialize_rule(row['id'])
                if rule_data:
                    rules.append(rule_data)

            response = jsonify({
                "status": "success",
                "rules": rules
            })
            return response

    except Exception as e:
        app.logger.error(f"Error in get-rules: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve rules",
            "error": str(e)
        }), 500


@app.route('/add-rule', methods=['POST'])
def add_rule():
    """Endpoint to add a new rule with proper action handling"""
    try:
        data = request.get_json()
        rule_text = data.get('rule', '').strip()

        if not rule_text:
            return jsonify({
                "status": "invalid",
                "message": "Rule text is required"
            }), 400

        try:
            # Add debug logging for the raw rule text
            app.logger.debug(f"Raw rule text received: {rule_text}")
            model = metamodel.model_from_str(rule_text)
            rule_def = model.rule_definitions[0]

            # Debug log the parsed action
            app.logger.debug(f"Parsed action type: {type(rule_def.action)}")
            app.logger.debug(f"Action details: {vars(rule_def.action)}")

        except TextXSyntaxError as e:
            error_msg = f"Syntax error: {e.message}"
            if any(ex in e.message for ex in VALID_EXERCISES):
                error_msg += f". Valid exercises: {', '.join(VALID_EXERCISES)}"
            return jsonify({
                "status": "invalid",
                "message": error_msg,
                "location": {"line": e.line, "column": e.col}
            }), 400

        with get_cursor() as cur:
            # Insert rule
            rule_name = f"Rule {rule_def.name.number}"
            cur.execute("INSERT INTO rules (name) VALUES (%s)", (rule_name,))
            rule_id = cur.lastrowid

            # Insert conditions
            for cond in rule_def.condition.conditions:
                value = cond.value
                if isinstance(value, str):
                    value = value.strip('"')
                cur.execute("""
                    INSERT INTO conditions 
                    (rule_id, variable, operator, value)
                    VALUES (%s, %s, %s, %s)
                """, (rule_id, cond.variable, cond.operator, str(value)))

            # Process actions with explicit validation
            action = rule_def.action
            action_type = None

            if hasattr(action, 'exercise'):  # ExerciseAction
                exercise_name = action.exercise.strip('"')  # Remove quotes
                if exercise_name not in VALID_EXERCISES:
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid exercise: {exercise_name}",
                        "valid_exercises": VALID_EXERCISES
                    }), 400

                cur.execute("""
                    INSERT INTO actions 
                    (rule_id, action_type, exercise_name, sets_count, reps_count)
                    VALUES (%s, %s, %s, NULL, NULL)
                """, (rule_id, 'include_exercise', exercise_name))
                action_type = 'exercise'

            elif hasattr(action, 'sets_count') and hasattr(action, 'reps_count'):  # SetsRepsAction
                if not (1 <= action.sets_count <= 10):
                    return jsonify({
                        "status": "invalid",
                        "message": "Sets must be between 1-10"
                    }), 400

                if not (1 <= action.reps_count <= 20):
                    return jsonify({
                        "status": "invalid",
                        "message": "Reps must be between 1-20"
                    }), 400

                cur.execute("""
                    INSERT INTO actions 
                    (rule_id, action_type, exercise_name, sets_count, reps_count)
                    VALUES (%s, %s, NULL, %s, %s)
                """, (rule_id, 'sets_reps', action.sets_count, action.reps_count))
                action_type = 'sets_reps'

            elif hasattr(action, 'min_time') and hasattr(action, 'max_time'):  # RestTimeAction
                min_seconds = action.min_time.minutes * 60
                max_seconds = action.max_time.minutes * 60

                cur.execute("""
                                    INSERT INTO actions 
                                    (rule_id, action_type, min_rest_time, max_rest_time)
                                    VALUES (%s, %s, %s, %s)
                                """, (rule_id, 'rest_time', min_seconds, max_seconds))
                action_type = 'rest_time'

            else:
                return jsonify({
                    "status": "invalid",
                    "message": "Unsupported action type",
                    "valid_actions": ["include_exercise", "sets X reps Y"]
                }), 400

            # Return complete rule details
            rule_data = serialize_rule(rule_id)
            return jsonify({
                "status": "success",
                "message": f"Rule added with {action_type} action",
                "rule": rule_data
            })

    except Exception as e:
        app.logger.error(f"Add rule error: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/validate-rule', methods=['POST'])
def validate_rule():
    """Endpoint to validate a rule without saving it"""
    try:
        data = request.get_json()
        rule_text = data.get('rule', '').strip()
        app.logger.debug(f"Validating rule text: {rule_text}")

        if not rule_text:
            return jsonify({
                "status": "invalid",
                "message": "Rule text is required"
            }), 400

        try:
            model = metamodel.model_from_str(rule_text)

            if not hasattr(model, 'rule_definitions') or not model.rule_definitions:
                return jsonify({
                    "status": "invalid",
                    "message": "No rule definition found"
                }), 400

            rule_def = model.rule_definitions[0]

            # Serialize the rule definition properly
            serialized_rule = {
                "name": f"Rule {rule_def.name.number}",
                "conditions": [],
                "action": {}
            }

            # Validate all conditions
            for cond in rule_def.condition.conditions:
                variable = cond.variable
                operator = cond.operator
                value = cond.value

                # Convert value to string for validation
                str_value = str(value) if hasattr(value, '__str__') else value

                # Store condition for response
                condition_data = {
                    "variable": variable,
                    "operator": operator,
                    "value": str_value
                }
                serialized_rule["conditions"].append(condition_data)

                # Validate variable
                valid_vars = ["muscle_group", "goal", "duration", "age", "fitness_level"]
                if variable not in valid_vars:
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid variable: {variable}. Valid variables: {', '.join(valid_vars)}"
                    }), 400

                # Validate operator
                valid_ops = ["==", "!=", "<", ">", "<=", ">="]
                if operator not in valid_ops:
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid operator: {operator}. Valid operators: {', '.join(valid_ops)}"
                    }), 400

                # Variable-specific validation
                if variable == "muscle_group":
                    if str_value not in VALID_MUSCLES:
                        return jsonify({
                            "status": "invalid",
                            "message": f"Invalid muscle group: {str_value}. Valid muscles: {', '.join(VALID_MUSCLES)}"
                        }), 400

                elif variable == "goal":
                    if str_value not in VALID_GOAL_TYPES:
                        return jsonify({
                            "status": "invalid",
                            "message": f"Invalid goal: {str_value}. Valid goals: {', '.join(VALID_GOAL_TYPES)}"
                        }), 400

                elif variable == "fitness_level":
                    if str_value not in VALID_LEVELS:
                        return jsonify({
                            "status": "invalid",
                            "message": f"Invalid level: {str_value}. Valid levels: {', '.join(VALID_LEVELS)}"
                        }), 400

                elif variable == "duration":
                    # Handle duration validation (supports both raw numbers and Time objects)
                    duration_minutes = None
                    if isinstance(value, int):
                        duration_minutes = value
                    elif hasattr(value, 'minutes'):  # Time object from DSL
                        duration_minutes = value.minutes
                    elif isinstance(str_value, str) and str_value.endswith('m'):
                        try:
                            duration_minutes = int(str_value[:-1])
                        except ValueError:
                            return jsonify({
                                "status": "invalid",
                                "message": "Duration must be a number (e.g., 30 or 30m)"
                            }), 400
                    else:
                        return jsonify({
                            "status": "invalid",
                            "message": "Duration must be in minutes (e.g., 30 or 30m)"
                        }), 400

                    # Validate duration range (5 minutes to 3 hours)
                    if not (5 <= duration_minutes <= 180):
                        return jsonify({
                            "status": "invalid",
                            "message": "Duration must be between 5-180 minutes"
                        }), 400

                elif variable == "age":
                    try:
                        age = int(str_value)
                        if not (15 <= age <= 100):
                            return jsonify({
                                "status": "invalid",
                                "message": "Age must be between 15-100"
                            }), 400
                    except ValueError:
                        return jsonify({
                            "status": "invalid",
                            "message": "Age must be a number"
                        }), 400

            # Validate action
            action = rule_def.action
            if hasattr(action, 'exercise'):
                # Exercise inclusion action
                exercise_name = action.exercise.strip('"') if isinstance(action.exercise, str) else str(action.exercise)
                if exercise_name not in VALID_EXERCISES:
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid exercise: {exercise_name}. Valid exercises: {', '.join(VALID_EXERCISES)}"
                    }), 400
                serialized_rule["action"]["type"] = "include_exercise"
                serialized_rule["action"]["exercise"] = exercise_name

            elif hasattr(action, 'sets_count') and hasattr(action, 'reps_count'):
                # Sets/reps action
                if not (1 <= action.sets_count <= 10):
                    return jsonify({
                        "status": "invalid",
                        "message": "Sets must be between 1-10"
                    }), 400
                if not (1 <= action.reps_count <= 20):
                    return jsonify({
                        "status": "invalid",
                        "message": "Reps must be between 1-20"
                    }), 400
                serialized_rule["action"]["type"] = "sets_reps"
                serialized_rule["action"]["sets_count"] = action.sets_count
                serialized_rule["action"]["reps_count"] = action.reps_count

            elif hasattr(action, 'min_time') and hasattr(action, 'max_time'):
                # Rest time action
                min_seconds = action.min_time.minutes * 60
                max_seconds = action.max_time.minutes * 60

                if not (30 <= min_seconds <= 300):  # 0.5-5 minutes
                    return jsonify({
                        "status": "invalid",
                        "message": "Minimum rest time must be between 30-300 seconds"
                    }), 400

                if not (60 <= max_seconds <= 600):  # 1-10 minutes
                    return jsonify({
                        "status": "invalid",
                        "message": "Maximum rest time must be between 60-600 seconds"
                    }), 400

                if min_seconds > max_seconds:
                    return jsonify({
                        "status": "invalid",
                        "message": "Minimum rest time cannot be greater than maximum"
                    }), 400

                serialized_rule["action"]["type"] = "rest_time"
                serialized_rule["action"]["min_rest_time"] = min_seconds
                serialized_rule["action"]["max_rest_time"] = max_seconds

            else:
                return jsonify({
                    "status": "invalid",
                    "message": "Unknown action type",
                    "valid_actions": ["include_exercise", "sets X reps Y", "set_rest_time min Xm max Ym"]
                }), 400

            return jsonify({
                "status": "valid",
                "message": "Rule is valid",
                "rule": serialized_rule
            })

        except TextXSyntaxError as e:
            error_msg = f"Syntax error: {e.message}"
            if any(ex in e.message for ex in VALID_EXERCISES):
                error_msg += f". Valid exercises: {', '.join(VALID_EXERCISES)}"
            elif "duration" in e.message:
                error_msg += ". Duration must be in minutes (5-180) as number or with 'm' suffix (e.g., 30 or 30m)"
            elif "set_rest_time" in e.message:
                error_msg += ". Format should be: 'set_rest_time min Xm max Ym' (e.g., 'set_rest_time min 1m max 2m')"
            return jsonify({
                "status": "invalid",
                "message": error_msg,
                "location": {"line": e.line, "column": e.col}
            }), 400

    except Exception as e:
        app.logger.error(f"Validation error: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/add-exercise', methods=['POST'])
def add_exercise():
    """Endpoint to add a new exercise"""
    try:
        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({
                "status": "invalid",
                "message": "Exercise name is required"
            }), 400

        exercise_name = data['name']
        if exercise_name not in VALID_EXERCISES:
            return jsonify({
                "status": "invalid",
                "message": f"Invalid exercise name. Must be one of: {', '.join(VALID_EXERCISES)}"
            }), 400

        with get_cursor() as cur:
            # Get exercise type ID
            cur.execute("SELECT id FROM record_types WHERE name = 'Exercise'")
            rt = cur.fetchone()
            if not rt:
                return jsonify({
                    "status": "error",
                    "message": "Exercise type not defined"
                }), 400
            rt_id = rt['id']

            # Create record
            cur.execute("INSERT INTO records (record_type_id) VALUES (%s)", (rt_id,))
            record_id = cur.lastrowid

            # Insert values
            for attr, value in data.items():
                cur.execute("""
                    SELECT id FROM attributes 
                    WHERE record_type_id = %s AND name = %s
                """, (rt_id, attr))
                attr_result = cur.fetchone()
                if not attr_result:
                    continue
                attr_id = attr_result['id']
                cur.execute("""
                    INSERT INTO record_values 
                    (record_id, attribute_id, value)
                    VALUES (%s, %s, %s)
                """, (record_id, attr_id, str(value)))

            return jsonify({
                "status": "success",
                "exercise_id": record_id
            })

    except Exception as e:
        app.logger.error(f"Add exercise error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/get-datamodel', methods=['GET'])
def get_datamodel():
    try:
        with get_cursor() as cur:
            # Get record types with attributes
            cur.execute("""
                SELECT rt.name AS type_name, a.name, a.type, a.initial_value
                FROM record_types rt
                LEFT JOIN attributes a ON rt.id = a.record_type_id
                ORDER BY rt.name, a.id
            """)

            # ... rest of your original implementation ...

            return jsonify({"status": "success", "record_types": record_types})

    except Exception as e:
        app.logger.error(f"Data model error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/update-datamodel', methods=['POST'])
def update_datamodel():
    try:
        data = request.get_json()
        record_type = data['record_type']
        attribute = data['attribute']

        with get_cursor() as cur:
            # ... your original implementation ...

            return jsonify({"status": "success"})

    except Exception as e:
        app.logger.error(f"Update datamodel error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 400


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
