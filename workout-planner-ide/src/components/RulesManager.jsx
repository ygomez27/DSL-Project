import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RulesManager = ({ section }) => {
  const [rules, setRules] = useState([]);
  const [grammarOptions, setGrammarOptions] = useState({
    variables: [],
    operators: [],
    goal_types: [],
    levels: [],
    muscles: [],
    exercise_names: [],
    actions: []
  });

  // Form state
  const [selectedVariable, setSelectedVariable] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(8);
  const [minRestTime, setMinRestTime] = useState(60); // in seconds
  const [maxRestTime, setMaxRestTime] = useState(120); // in seconds
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch grammar options on mount
  useEffect(() => {
    const fetchGrammar = async () => {
      try {
        const response = await axios.get('http://localhost:5000/analyze-grammar');
        setGrammarOptions(response.data);
      } catch (err) {
        setError('Failed to load grammar options');
      }
    };
    fetchGrammar();
  }, []);

  // Fetch rules when section changes
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await axios.get('http://localhost:5000/get-rules');
        setRules(response.data.rules);
      } catch (err) {
        setError('Failed to load rules');
      }
    };
    fetchRules();
  }, [section]);

  const validateForm = () => {
    setError('');

    if (!selectedVariable || !selectedOperator || !selectedValue || !selectedAction) {
      setError('All fields marked with * are required');
      return false;
    }

    if (selectedVariable === 'duration' && isNaN(selectedValue)) {
      setError('Duration must be a number');
      return false;
    }

    if (selectedVariable === 'age' && (selectedValue < 15 || selectedValue > 100)) {
      setError('Age must be between 15-100');
      return false;
    }

    if (selectedAction === 'include_exercise' && (!selectedExercise || selectedExercise.trim() === '')) {
      setError('Please select a valid exercise');
      return false;
    }

    if (selectedAction === 'sets') {
      if (isNaN(sets) || sets < 1 || sets > 10) {
        setError('Sets must be between 1-10');
        return false;
      }
      if (isNaN(reps) || reps < 1 || reps > 20) {
        setError('Reps must be between 1-20');
        return false;
      }
    }

    if (selectedAction === 'set_rest_time') {
      if (minRestTime < 30 || minRestTime > 300) {
        setError('Minimum rest time must be between 30-300 seconds');
        return false;
      }
      if (maxRestTime < 60 || maxRestTime > 600) {
        setError('Maximum rest time must be between 60-600 seconds');
        return false;
      }
      if (minRestTime > maxRestTime) {
        setError('Minimum rest time cannot be greater than maximum');
        return false;
      }
    }

    return true;
  };

  const addRule = async () => {
    if (!validateForm()) return;

    try {
      const nextRuleNumber = rules.reduce((maxId, rule) => {
        const match = rule.name.match(/Rule(\d+)/);
        const id = match ? parseInt(match[1], 10) : 0;
        return id > maxId ? id : maxId;
      }, 0) + 1;

      // Format value based on variable type
      let formattedValue;
      if (selectedVariable === 'muscle_group' || selectedVariable === 'goal') {
        formattedValue = `"${selectedValue}"`;
      } else if (selectedVariable === 'duration') {
        formattedValue = `${selectedValue}m`;
      } else if (selectedVariable === 'fitness_level') {
        formattedValue = selectedValue;
      } else {
        formattedValue = isNaN(selectedValue) ? `"${selectedValue}"` : selectedValue;
      }

      const condition = `${selectedVariable} ${selectedOperator} ${formattedValue}`;
      
      let action;
      if (selectedAction === 'include_exercise') {
        action = `include_exercise "${selectedExercise}"`;
      } else if (selectedAction === 'sets') {
        action = `sets ${sets} reps ${reps}`;
      } else if (selectedAction === 'set_rest_time') {
        action = `set_rest_time min ${minRestTime / 60}m max ${maxRestTime / 60}m`;
      }

      const ruleText = `rule Rule${nextRuleNumber} if ${condition} then ${action}`;
      console.log('Constructed Rule Text:', ruleText);

      setLoading(true);
      
      // First validate the rule
      const validationResponse = await axios.post(
        'http://localhost:5000/validate-rule',
        { rule: ruleText }
      );

      if (validationResponse.data.status === 'invalid') {
        throw new Error(validationResponse.data.message);
      }

      // If valid, save the rule
      const saveResponse = await axios.post('http://localhost:5000/add-rule', { rule: ruleText });
      
      // Refresh rules list
      const rulesResponse = await axios.get('http://localhost:5000/get-rules');
      setRules(rulesResponse.data.rules);
      resetForm();

    } catch (err) {
      console.error('Rule creation error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedVariable('');
    setSelectedOperator('');
    setSelectedValue('');
    setSelectedAction('');
    setSelectedExercise('');
    setSets(3);
    setReps(8);
    setMinRestTime(60);
    setMaxRestTime(120);
    setError('');
  };

  const renderActionInputs = () => {
    switch(selectedAction) {
      case 'include_exercise':
        return (
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="action-input"
            required
          >
            <option value="">Select Exercise</option>
            {grammarOptions.exercise_names.map((ex, i) => (
              <option key={i} value={ex}>{ex}</option>
            ))}
          </select>
        );
      case 'sets':
        return (
          <div className="sets-reps-container">
            <input
              type="number"
              value={sets}
              onChange={(e) => setSets(Math.max(1, Math.min(10, e.target.value)))}
              placeholder="Sets"
              min="1"
              max="10"
              required
            />
            <span>×</span>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(Math.max(1, Math.min(20, e.target.value)))}
              placeholder="Reps"
              min="1"
              max="20"
              required
            />
          </div>
        );
      case 'set_rest_time':
        return (
          <div className="rest-time-container">
            <div className="rest-time-input">
              <label>Min Rest (seconds)</label>
              <input
                type="number"
                value={minRestTime}
                onChange={(e) => setMinRestTime(Math.max(30, Math.min(300, e.target.value)))}
                min="30"
                max="300"
                required
              />
            </div>
            <div className="rest-time-input">
              <label>Max Rest (seconds)</label>
              <input
                type="number"
                value={maxRestTime}
                onChange={(e) => setMaxRestTime(Math.max(60, Math.min(600, e.target.value)))}
                min="60"
                max="600"
                required
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getValueOptions = () => {
    switch(selectedVariable) {
      case 'goal': return grammarOptions.goal_types;
      case 'muscle_group': return grammarOptions.muscles;
      case 'fitness_level': return grammarOptions.levels;
      case 'duration': return [];
      case 'age': return [];
      default: return [];
    }
  };

  return (
    <div className="rules-manager">
      <h2>{section} Rules Management</h2>
      
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          {error.includes('exercise') && (
            <div className="valid-exercises">
              Valid exercises: {grammarOptions.exercise_names.join(', ')}
            </div>
          )}
        </div>
      )}

      <div className="rule-creation">
        <div className="condition-section">
          <h3>Create Condition</h3>
          <div className="condition-fields">
            <select
              value={selectedVariable}
              onChange={(e) => {
                setSelectedVariable(e.target.value);
                setSelectedValue('');
              }}
              required
            >
              <option value="">Variable*</option>
              {grammarOptions.variables.map((v, i) => (
                <option key={i} value={v}>{v}</option>
              ))}
            </select>

            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              required
            >
              <option value="">Operator*</option>
              {grammarOptions.operators.map((op, i) => (
                <option key={i} value={op}>{op}</option>
              ))}
            </select>

            {getValueOptions().length > 0 ? (
              <select
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                required
              >
                <option value="">Value*</option>
                {getValueOptions().map((val, i) => (
                  <option key={i} value={val}>{val}</option>
                ))}
              </select>
            ) : (
              <input
                type={selectedVariable === 'age' || selectedVariable === 'duration' ? 'number' : 'text'}
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                placeholder={
                  selectedVariable === 'duration' ? 'Minutes (e.g., 30)' :
                  selectedVariable === 'age' ? 'Enter age (15-100)' :
                  'Enter value'
                }
                min={selectedVariable === 'age' ? 15 : selectedVariable === 'duration' ? 1 : undefined}
                max={selectedVariable === 'age' ? 100 : undefined}
                required
              />
            )}
          </div>
        </div>

        <div className="action-section">
          <h3>Define Action</h3>
          <div className="action-fields">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              required
            >
              <option value="">Action Type*</option>
              {grammarOptions.actions.map((a, i) => (
                <option key={i} value={a}>{a}</option>
              ))}
            </select>
            {renderActionInputs()}
          </div>
        </div>

        <button 
          onClick={addRule} 
          disabled={loading}
          className={`save-button ${loading ? 'loading' : ''}`}
        >
          {loading ? 'Saving...' : 'Create Rule'}
        </button>
      </div>

      <div className="rules-list">
        <h3>Active Rules</h3>
        {rules.length === 0 ? (
          <p className="no-rules">No rules configured</p>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="rule-item">
              <div className="rule-header">
                <span className="rule-name">{rule.name}</span>
                <span className="rule-id">ID: {rule.id}</span>
              </div>
              
              <div className="rule-conditions">
                <span>Conditions:</span>
                {rule.conditions.map((cond, i) => (
                  <div key={i} className="condition-item">
                    <span className="variable">{cond.variable}</span>
                    <span className="operator">{cond.operator}</span>
                    <span className="value">{cond.value}</span>
                  </div>
                ))}
              </div>

              <div className="rule-actions">
                <span>Actions:</span>
                {rule.actions.map((action, i) => (
                  <div key={i} className="action-item">
                    {action.action_type === 'include_exercise' && (
                      <span className="exercise-action">
                        Add: <strong>{action.exercise_name}</strong>
                      </span>
                    )}
                    {action.action_type === 'sets_reps' && (
                      <span className="sets-reps-action">
                        <strong>{action.sets_count}</strong> sets × 
                        <strong> {action.reps_count}</strong> reps
                      </span>
                    )}
                    {action.action_type === 'rest_time' && (
                      <span className="rest-time-action">
                        Rest: <strong>{action.min_rest_time}s</strong> to <strong>{action.max_rest_time}s</strong>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RulesManager;