from MySQLdb import IntegrityError
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
    SimpleVariable | RecordVariable
;

SimpleVariable:
    "muscle_group" | "goal" | "duration" | "age" | "fitness_level"
;

RecordVariable:
    record_type=ID '.' field=ID
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
    ExerciseAction | SetsRepsAction | RestTimeAction
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


def get_valid_values(table_name):
    try:
        with get_cursor() as cur:
            cur.execute(f"SELECT name FROM {table_name}")
            return [row['name'] for row in cur.fetchall()]
    except Exception as e:
        app.logger.error(f"Error fetching {table_name}: {str(e)}")
        return []


# Endpoints
@app.route('/init-db', methods=['POST'])
def initialize_db():
    default_data = {
        'valid_exercises': [
            "Lat Pulldown", "Bent-over Rows", "Deadlifts", "Squats", "Lunges",
            "Push-up", "Bench Press", "Incline Dumbbell Press", "Chest Flys",
            "Overhead Press", "Lateral Raises", "Bicep Curls", "Triceps Dips",
            "Burpees", "Dumbbell Row", "Leg Press"
        ],
        'valid_goals': ["Muscle Gain", "Fat Loss", "Strength", "Endurance"],
        'valid_muscles': ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Full Body", "Dorsales"],
        'valid_levels': ["Beginner", "Intermediate", "Advanced"]
    }

    try:
        with get_cursor() as cur:
            for table, values in default_data.items():
                for value in values:
                    try:
                        cur.execute(f"INSERT INTO {table} (name) VALUES (%s)", (value,))
                    except IntegrityError:
                        pass
            return jsonify({"status": "success", "message": "Database initialized"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def get_valid_exercises():
    return get_valid_values('valid_exercises')


def get_valid_goals():
    return get_valid_values('valid_goals')


def get_valid_muscles():
    return get_valid_values('valid_muscles')


def get_valid_levels():
    return get_valid_values('valid_levels')


# Endpoints
@app.route('/analyze-grammar', methods=['GET'])
def analyze_grammar():
    try:
        with get_cursor() as cur:
            # Get simple variables
            simple_vars = ["muscle_group", "goal", "duration", "age", "fitness_level"]

            # Get record variables
            cur.execute("""
                SELECT rt.name as record_type, a.name as field
                FROM record_types rt
                JOIN attributes a ON rt.id = a.record_type_id
            """)
            record_vars = [f"{row['record_type']}.{row['field']}" for row in cur.fetchall()]

            # Combine variables
            all_vars = simple_vars + record_vars

        return jsonify({
            "variables": all_vars,
            "operators": ["==", "!=", "<", ">", "<=", ">="],
            "actions": ["include_exercise", "sets", "set_rest_time"],
            "exercise_names": get_valid_values('valid_exercises'),
            "goal_types": get_valid_values('valid_goals'),
            "levels": get_valid_values('valid_levels'),
            "muscles": get_valid_values('valid_muscles'),
            "customizable_sr": True
        })
    except Exception as e:
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
            model = metamodel.model_from_str(rule_text)
            rule_def = model.rule_definitions[0]

        except TextXSyntaxError as e:
            error_msg = f"Syntax error: {e.message}"
            if any(ex in e.message for ex in get_valid_exercises()):
                error_msg += f". Valid exercises: {', '.join(get_valid_exercises())}"
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

            # Insert conditions with proper variable formatting
            for cond in rule_def.condition.conditions:
                # Handle RecordVariable objects
                try:
                    # Check if this is a RecordVariable from textX
                    variable_str = f"{cond.variable.record_type}.{cond.variable.field}"
                except AttributeError:
                    # Regular variable
                    variable_str = str(cond.variable)

                value = cond.value
                if isinstance(value, str):
                    value = value.strip('"')

                cur.execute("""
                    INSERT INTO conditions 
                    (rule_id, variable, operator, value)
                    VALUES (%s, %s, %s, %s)
                """, (rule_id, variable_str, cond.operator, str(value)))

            # Process actions
            action = rule_def.action
            action_type = None

            if hasattr(action, 'exercise'):
                exercise_name = action.exercise.strip('"')
                if exercise_name not in get_valid_exercises():
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid exercise: {exercise_name}",
                        "valid_exercises": get_valid_exercises()
                    }), 400

                cur.execute("""
                    INSERT INTO actions 
                    (rule_id, action_type, exercise_name, sets_count, reps_count)
                    VALUES (%s, %s, %s, NULL, NULL)
                """, (rule_id, 'include_exercise', exercise_name))
                action_type = 'exercise'

            elif hasattr(action, 'sets_count') and hasattr(action, 'reps_count'):
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

            elif hasattr(action, 'min_time') and hasattr(action, 'max_time'):
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

            with get_cursor() as cur:
                valid_vars = ["muscle_group", "goal", "duration", "age", "fitness_level"]
                cur.execute("""
                    SELECT rt.name as record_type, a.name as field
                    FROM record_types rt
                    JOIN attributes a ON rt.id = a.record_type_id
                """)
                record_vars = [f"{row['record_type']}.{row['field']}" for row in cur.fetchall()]
                all_valid_vars = valid_vars + record_vars

            serialized_rule = {
                "name": f"Rule {rule_def.name.number}",
                "conditions": [],
                "action": {}
            }

            for cond in rule_def.condition.conditions:
                try:
                    var_str = f"{cond.variable.record_type}.{cond.variable.field}"
                except AttributeError:
                    var_str = str(cond.variable)

                operator = cond.operator
                value = cond.value
                str_value = str(value) if hasattr(value, '__str__') else value

                condition_data = {
                    "variable": var_str,
                    "operator": operator,
                    "value": str_value
                }
                serialized_rule["conditions"].append(condition_data)

                if var_str not in all_valid_vars:
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid variable: {var_str}. Valid variables: {', '.join(all_valid_vars)}"
                    }), 400

                valid_ops = ["==", "!=", "<", ">", "<=", ">="]
                if operator not in valid_ops:
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid operator: {operator}. Valid operators: {', '.join(valid_ops)}"
                    }), 400

                if var_str == "muscle_group":
                    if str_value not in get_valid_muscles():
                        return jsonify({
                            "status": "invalid",
                            "message": f"Invalid muscle group: {str_value}. Valid muscles: {', '.join(get_valid_muscles())}"
                        }), 400

                elif var_str == "goal":
                    if str_value not in get_valid_goals():
                        return jsonify({
                            "status": "invalid",
                            "message": f"Invalid goal: {str_value}. Valid goals: {', '.join(get_valid_goals())}"
                        }), 400

                elif var_str == "fitness_level":
                    if str_value not in get_valid_levels():
                        return jsonify({
                            "status": "invalid",
                            "message": f"Invalid level: {str_value}. Valid levels: {', '.join(get_valid_levels())}"
                        }), 400

                elif var_str == "duration":
                    duration_minutes = None
                    if isinstance(value, int):
                        duration_minutes = value
                    elif hasattr(value, 'minutes'):
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

                    if not (5 <= duration_minutes <= 180):
                        return jsonify({
                            "status": "invalid",
                            "message": "Duration must be between 5-180 minutes"
                        }), 400

                elif var_str == "age":
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

            action = rule_def.action
            if hasattr(action, 'exercise'):
                exercise_name = action.exercise.strip('"') if isinstance(action.exercise, str) else str(action.exercise)
                if exercise_name not in get_valid_exercises():
                    return jsonify({
                        "status": "invalid",
                        "message": f"Invalid exercise: {exercise_name}. Valid exercises: {', '.join(get_valid_exercises())}"
                    }), 400
                serialized_rule["action"]["type"] = "include_exercise"
                serialized_rule["action"]["exercise"] = exercise_name

            elif hasattr(action, 'sets_count') and hasattr(action, 'reps_count'):
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
                min_seconds = action.min_time.minutes * 60
                max_seconds = action.max_time.minutes * 60

                if not (30 <= min_seconds <= 300):
                    return jsonify({
                        "status": "invalid",
                        "message": "Minimum rest time must be between 30-300 seconds"
                    }), 400

                if not (60 <= max_seconds <= 600):
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
            if any(ex in e.message for ex in get_valid_exercises()):
                error_msg += f". Valid exercises: {', '.join(get_valid_exercises())}"
            elif "duration" in e.message:
                error_msg += ". Duration must be in minutes (5-180) as number or with 'm' suffix"
            elif "set_rest_time" in e.message:
                error_msg += ". Format: 'set_rest_time min Xm max Ym' (e.g., 'set_rest_time min 1m max 2m')"
            elif "variable" in e.message.lower():
                error_msg += f". Valid variables: {', '.join(all_valid_vars)}"

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
        if exercise_name not in get_valid_exercises():
            return jsonify({
                "status": "invalid",
                "message": f"Invalid exercise name. Must be one of: {', '.join(get_valid_exercises())}"
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
            # Get domain values
            domain_tables = {
                'valid_exercises': 'exercise_names',
                'valid_goals': 'goal_types',
                'valid_muscles': 'muscles',
                'valid_levels': 'levels'
            }
            domain_values = {}
            for table, key in domain_tables.items():
                cur.execute(f"SELECT name FROM {table}")
                domain_values[key] = [row['name'] for row in cur.fetchall()]

            # Get record types
            cur.execute("""
                SELECT rt.id, rt.name, 
                       a.id as attr_id, a.name as attr_name, 
                       a.type as attr_type, a.initial_value
                FROM record_types rt
                LEFT JOIN attributes a ON rt.id = a.record_type_id
                ORDER BY rt.name, a.name
            """)
            record_types = {}
            for row in cur.fetchall():
                if row['name'] not in record_types:
                    record_types[row['name']] = {
                        'id': row['id'],
                        'attributes': []
                    }
                if row['attr_id']:
                    record_types[row['name']]['attributes'].append({
                        'id': row['attr_id'],
                        'name': row['attr_name'],
                        'type': row['attr_type'],
                        'initial_value': row['initial_value']
                    })

            # Get records
            records = []
            cur.execute("""
                SELECT r.id, r.record_type_id, rt.name as type_name,
                       rv.attribute_id, a.name as attr_name, rv.value
                FROM records r
                JOIN record_types rt ON r.record_type_id = rt.id
                LEFT JOIN record_values rv ON r.id = rv.record_id
                LEFT JOIN attributes a ON rv.attribute_id = a.id
                ORDER BY r.id
            """)
            current_record = None
            for row in cur.fetchall():
                if not current_record or current_record['id'] != row['id']:
                    if current_record:
                        records.append(current_record)
                    current_record = {
                        'id': row['id'],
                        'type_id': row['record_type_id'],
                        'type_name': row['type_name'],
                        'values': {}
                    }
                if row['attr_name']:
                    current_record['values'][row['attr_name']] = row['value']
            if current_record:
                records.append(current_record)

            return jsonify({
                "status": "success",
                **domain_values,
                "record_types": record_types,
                "records": records
            })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/update-datamodel', methods=['POST'])
def update_datamodel():
    try:
        data = request.get_json()
        action = data.get('action')
        payload = data.get('payload')

        if not action or not payload:
            return jsonify({"status": "error", "message": "Action and payload required"}), 400

        with get_cursor() as cur:
            if action == 'add_valid_entry':
                table_map = {
                    'exercise': 'valid_exercises',
                    'goal': 'valid_goals',
                    'muscle': 'valid_muscles',
                    'level': 'valid_levels'
                }
                entry_type = payload.get('type')
                entry_name = payload.get('name')

                if not entry_type or not entry_name:
                    return jsonify({"status": "error", "message": "Type and name required"}), 400

                table = table_map.get(entry_type)
                if not table:
                    return jsonify({"status": "error", "message": "Invalid type"}), 400

                try:
                    cur.execute(f"INSERT INTO {table} (name) VALUES (%s)", (entry_name,))
                    return jsonify({"status": "success", "message": f"{entry_type} added"})
                except IntegrityError:
                    return jsonify({"status": "error", "message": "Entry exists"}), 400

            elif action == 'add_record_type':
                type_name = payload.get('name')
                if not type_name:
                    return jsonify({"status": "error", "message": "Name required"}), 400

                cur.execute("INSERT INTO record_types (name) VALUES (%s)", (type_name,))
                type_id = cur.lastrowid
                return jsonify({
                    "status": "success",
                    "message": "Record type added",
                    "type_id": type_id
                })

            elif action == 'add_attribute':
                type_id = payload.get('type_id')
                attr_name = payload.get('name')
                attr_type = payload.get('type')

                if not all([type_id, attr_name, attr_type]):
                    return jsonify({"status": "error", "message": "Missing fields"}), 400

                cur.execute("""
                    INSERT INTO attributes 
                    (record_type_id, name, type, initial_value)
                    VALUES (%s, %s, %s, %s)
                """, (type_id, attr_name, attr_type, payload.get('initial_value', '')))
                return jsonify({"status": "success", "message": "Attribute added"})

            elif action == 'add_record':
                type_id = payload.get('type_id')
                if not type_id:
                    return jsonify({"status": "error", "message": "Type ID required"}), 400

                cur.execute("INSERT INTO records (record_type_id) VALUES (%s)", (type_id,))
                record_id = cur.lastrowid

                for attr_name, value in payload.get('values', {}).items():
                    cur.execute("""
                        SELECT id FROM attributes 
                        WHERE record_type_id = %s AND name = %s
                    """, (type_id, attr_name))
                    attr = cur.fetchone()
                    if attr:
                        cur.execute("""
                            INSERT INTO record_values 
                            (record_id, attribute_id, value)
                            VALUES (%s, %s, %s)
                        """, (record_id, attr['id'], str(value)))

                return jsonify({
                    "status": "success",
                    "message": "Record added",
                    "record_id": record_id
                })

            elif action == 'update_record':
                record_id = payload.get('record_id')
                if not record_id:
                    return jsonify({"status": "error", "message": "Record ID required"}), 400

                for attr_name, value in payload.get('values', {}).items():
                    cur.execute("""
                        UPDATE record_values rv
                        JOIN attributes a ON rv.attribute_id = a.id
                        SET rv.value = %s
                        WHERE rv.record_id = %s AND a.name = %s
                    """, (str(value), record_id, attr_name))

                return jsonify({"status": "success", "message": "Record updated"})

            elif action == 'delete_record':
                record_id = payload.get('record_id')
                if not record_id:
                    return jsonify({"status": "error", "message": "Record ID required"}), 400

                cur.execute("DELETE FROM record_values WHERE record_id = %s", (record_id,))
                cur.execute("DELETE FROM records WHERE id = %s", (record_id,))
                return jsonify({"status": "success", "message": "Record deleted"})

            else:
                return jsonify({"status": "error", "message": "Invalid action"}), 400

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
