from flask import Flask, request, jsonify
from flask_cors import CORS
from textx import metamodel_from_str, TextXSyntaxError
from textx.metamodel import textx

app = Flask(__name__)
CORS(app)

# In-memory storage
saved_statements = []
data_model = {
    "record_types": {
        "Exercise": {
            "attributes": [
                {"name": "name", "type": "String", "initial": ""},
                {"name": "sets", "type": "Integer", "initial": 3},
                {"name": "repetitions", "type": "Integer", "initial": 10},
                {"name": "rest", "type": "Time", "initial": "60s"}
            ]
        },
        "WorkoutPlan": {
            "attributes": [
                {"name": "day", "type": "DayOfWeek", "initial": "Monday"},
                {"name": "muscle_group", "type": "MuscleGroup", "initial": "Chest"},
                {"name": "goal", "type": "GoalType", "initial": "Muscle Gain"},
                {"name": "duration", "type": "Time", "initial": "60m"}
            ]
        }
    },
    "records": {
        "Exercise": [],
        "WorkoutPlan": []
    }
}

# Corrected DSL Grammar
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
    "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"
;

MuscleGroup:
    'muscle_group' muscles+=Muscle (',' muscles+=Muscle)*
;

Muscle:
    "Chest" | "Back" | "Legs" | "Shoulders" | "Arms" | "Core" | "Full Body" | "Dorsales"
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
    'exercise' name=ExerciseName
;

ExerciseName:
    "Lat Pulldown" | "Bent-over Rows" | "Deadlifts" | "Squats" | "Lunges" |
    "Push-up" | "Bench Press" | "Incline Dumbbell Press" | "Chest Flys" |
    "Overhead Press" | "Lateral Raises" | "Bicep Curls" | "Triceps Dips" |
    "Burpees" | "Dumbbell Row" | "Leg Press"
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
    'include_exercise' exercise=ExerciseName
     | 'sets' sets_count=INT 'reps' reps_count=INT
;
"""

metamodel = metamodel_from_str(DSL_GRAMMAR)


@app.route('/get-datamodel', methods=['GET'])
def get_datamodel():
    return jsonify({
        "status": "success",
        "record_types": data_model["record_types"],
        "records": data_model["records"]
    })


@app.route('/update-datamodel', methods=['POST'])
def update_datamodel():
    try:
        data = request.get_json()
        record_type = data['record_type']
        attribute = data['attribute']

        # Update record type definition
        data_model["record_types"][record_type]["attributes"].append({
            "name": attribute["name"],
            "type": attribute["type"],
            "initial": attribute.get("initial", "")
        })

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/analyze-grammar', methods=['GET'])
def analyze_grammar():
    try:
        # Manually define allowed values based on DSL grammar
        exercise_names = [
            "Lat Pulldown", "Bent-over Rows", "Deadlifts", "Squats", "Lunges",
            "Push-up", "Bench Press", "Incline Dumbbell Press", "Chest Flys",
            "Overhead Press", "Lateral Raises", "Bicep Curls", "Triceps Dips",
            "Burpees", "Dumbbell Row", "Leg Press"
        ]
        goal_types = ["Muscle Gain", "Fat Loss", "Strength", "Endurance"]
        variables = ["muscle_group", "goal", "duration", "age", "fitness_level"]
        levels = ["Beginner", "Intermediate", "Advanced"]

        # Add muscle groups from the Muscle rule in your DSL
        muscles = [
            "Chest", "Back", "Legs", "Shoulders",
            "Arms", "Core", "Full Body", "Dorsales"
        ]

        return jsonify({
            "variables": variables,
            "operators": ["==", "!=", "<", ">", "<=", ">="],
            "actions": ["include_exercise", "sets"],
            "exercise_names": exercise_names,
            "goal_types": goal_types,
            "levels": levels,
            "muscles": muscles,  # <-- Added muscle groups
            "customizable_sr": True
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/add-rule', methods=['POST'])
def add_rule():
    try:
        data = request.get_json()
        if not data or 'type' not in data or 'rule' not in data:
            return jsonify({"status": "error", "message": "Invalid request payload"}), 400

        rule_data = {"type": data['type'], "rule": data['rule']}
        saved_statements.append(rule_data)
        return jsonify({"status": "success", "message": "Rule added"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/get-rules', methods=['GET'])
def get_rules():
    try:
        rule_type = request.args.get('type')
        # Return the actual rule strings from saved_statements
        filtered_rules = [
            r['rule'] for r in saved_statements if r['type'] == rule_type
        ]
        return jsonify({"status": "success", "rules": filtered_rules})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/get-exercises', methods=['GET'])
def get_exercises():
    try:
        return jsonify({"status": "success", "exercises": data_model["exercises"]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/add-exercise', methods=['POST'])
def add_exercise():
    try:
        data = request.get_json()
        if 'exercise' not in data:
            return jsonify({"status": "error", "message": "Missing 'exercise' field"}), 400

        exercise = data['exercise']
        if exercise in data_model["exercises"]:
            return jsonify({"status": "error", "message": "Exercise already exists"}), 400

        data_model["exercises"].append(exercise)
        return jsonify({"status": "success", "message": "Exercise added"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/get-workout-plans', methods=['GET'])
def get_workout_plans():
    try:
        return jsonify({"status": "success", "workout_plans": data_model["workout_plans"]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/add-workout-plan', methods=['POST'])
def add_workout_plan():
    try:
        data = request.get_json()
        if 'workout_plan' not in data:
            return jsonify({"status": "error", "message": "Missing 'workout_plan' field"}), 400

        workout_plan = data['workout_plan']
        if workout_plan in data_model["workout_plans"]:
            return jsonify({"status": "error", "message": "Workout plan already exists"}), 400

        data_model["workout_plans"].append(workout_plan)
        return jsonify({"status": "success", "message": "Workout plan added"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route('/validate-rule', methods=['POST'])
def validate_rule():
    try:
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Missing JSON in request"
            }), 400

        data = request.get_json()

        if 'rule' not in data:
            return jsonify({
                "status": "error",
                "message": "Missing 'rule' field in request"
            }), 400

        rule_text = data['rule'].strip()

        if not rule_text:
            return jsonify({
                "status": "invalid",
                "message": "Empty rule provided"
            }), 200

        try:
            model = metamodel.model_from_str(rule_text)
        except TextXSyntaxError as e:
            return jsonify({
                "status": "invalid",
                "message": f"Syntax error: {e.message}",
                "location": {"line": e.line, "column": e.col}
            }), 200
        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Parsing failed: {str(e)}"
            }), 400

        if not hasattr(model, 'rule_definitions') or not model.rule_definitions:
            return jsonify({
                "status": "invalid",
                "message": "No valid rule definition found"
            }), 200

        rule_def = model.rule_definitions[0]
        errors = []

        # Condition validation
        if not hasattr(rule_def, 'condition') or not hasattr(rule_def.condition, 'conditions'):
            errors.append("Missing condition block")
        else:
            for cond in rule_def.condition.conditions:
                if not hasattr(cond, 'variable'):
                    errors.append("Condition missing variable")
                else:
                    if cond.variable not in ["muscle_group", "goal", "duration", "age", "fitness_level"]:
                        errors.append(f"Invalid variable: {cond.variable}")

                if not hasattr(cond, 'operator'):
                    errors.append("Condition missing operator")
                else:
                    if cond.operator not in ["==", "!=", "<", ">", "<=", ">="]:
                        errors.append(f"Invalid operator: {cond.operator}")

        # Action validation
        if not hasattr(rule_def, 'action'):
            errors.append("Missing action block")
        else:
            try:
                action_type = rule_def.action.__class__.__name__
                if action_type == 'IncludeExerciseAction':
                    if not hasattr(rule_def.action, 'exercise'):
                        errors.append("Include action missing exercise")
                elif action_type == 'SetsRepsAction':
                    if not hasattr(rule_def.action, 'sets_count') or not hasattr(rule_def.action, 'reps_count'):
                        errors.append("Sets/reps action missing counts")
                else:
                    errors.append(f"Unknown action type: {action_type}")
            except AttributeError as e:
                errors.append(f"Invalid action structure: {str(e)}")

        if errors:
            return jsonify({
                "status": "invalid",
                "message": "Semantic validation failed",
                "errors": errors
            }), 200

        return jsonify({
            "status": "valid",
            "message": "Rule is valid",
            "parsed": {
                "name": getattr(rule_def.name, 'number', 'unnamed'),
                "conditions": [f"{getattr(c, 'variable', '?')} {getattr(c, 'operator', '?')} {getattr(c, 'value', '?')}"
                               for c in getattr(rule_def.condition, 'conditions', [])],
                "action": str(getattr(rule_def, 'action', 'unknown'))
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/validate-rule', methods=['GET', 'PUT', 'DELETE', 'PATCH'])
def handle_invalid_methods():
    return jsonify({
        "status": "error",
        "message": "Method not allowed. Use POST for rule validation"
    }), 405


@app.route('/get-history', methods=['GET'])
def get_history():
    try:
        return jsonify({"status": "success", "history": saved_statements})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
