import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RulesManager = ({ section }) => {
  // State management
  const [rules, setRules] = useState([]);
  const [grammarOptions, setGrammarOptions] = useState({
    variables: [],
    operators: [],
    goal_types: [],
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
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
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
        const response = await axios.get(`http://localhost:5000/get-rules?type=${section}`);
        setRules(response.data.rules || []);
      } catch (err) {
        setError('Failed to load rules');
      }
    };
    fetchRules();
  }, [section]);

  // Form validation
  const validateForm = () => {
    if (!selectedVariable || !selectedOperator || !selectedValue || !selectedAction) {
      setError('All fields marked with * are required');
      return false;
    }

    if (selectedAction === 'include_exercise' && !selectedExercise) {
      setError('Please select an exercise');
      return false;
    }

    if (selectedAction === 'sets' && (!sets || !reps)) {
      setError('Please enter both sets and reps');
      return false;
    }

    return true;
  };

  // Submit new rule
  const addRule = async () => {
    if (!validateForm()) return;

    let actionPart;
    if (selectedAction === 'include_exercise') {
      actionPart = `include_exercise ${selectedExercise}`;
    } else if (selectedAction === 'sets') {
      actionPart = `sets ${sets} reps ${reps}`;
    }

    const newRule = `if ${selectedVariable} ${selectedOperator} ${selectedValue} then ${actionPart}`;

    try {
      setLoading(true);
      await axios.post('http://localhost:5000/add-rule', {
        type: section,
        rule: newRule
      });

      // Refresh rules
      const response = await axios.get(`http://localhost:5000/get-rules?type=${section}`);
      setRules(response.data.rules);

      // Reset form
      setSelectedVariable('');
      setSelectedOperator('');
      setSelectedValue('');
      setSelectedAction('');
      setSelectedExercise('');
      setSets('');
      setReps('');
      setError('');

    } catch (err) {
      setError('Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  // Render appropriate action inputs
  const renderActionInputs = () => {
    switch(selectedAction) {
      case 'include_exercise':
        return (
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="action-input"
          >
            <option value="">Select Exercise</option>
            {grammarOptions.exercise_names.map((ex, i) => (
              <option key={`ex-${i}`} value={ex}>{ex}</option>
            ))}
          </select>
        );

      case 'sets':
        return (
          <div className="sets-reps-container">
            <input
              type="number"
              min="1"
              placeholder="Sets"
              value={sets}
              onChange={(e) => setSets(e.target.value.replace(/[^0-9]/g, ''))}
              className="number-input"
            />
            <span className="multiply-symbol">×</span>
            <input
              type="number"
              min="1"
              placeholder="Reps"
              value={reps}
              onChange={(e) => setReps(e.target.value.replace(/[^0-9]/g, ''))}
              className="number-input"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Get available values based on selected variable
  const getValueOptions = () => {
    switch(selectedVariable) {
      case 'goal':
        return grammarOptions.goal_types;
      case 'muscle_group':
        return grammarOptions.muscles;
      default:
        return [];
    }
  };

  return (
    <div className="rules-manager-container">
      <h2>{section} Rules</h2>

      {error && <div className="error-banner">{error}</div>}

      <div className="rule-form">
        <div className="form-section">
          <label>Condition:</label>
          <div className="condition-group">
            <select
              value={selectedVariable}
              onChange={(e) => setSelectedVariable(e.target.value)}
              className="variable-select"
            >
              <option value="">Select Variable*</option>
              {grammarOptions.variables.map((v, i) => (
                <option key={`var-${i}`} value={v}>{v}</option>
              ))}
            </select>

            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="operator-select"
            >
              <option value="">Select Operator*</option>
              {grammarOptions.operators.map((op, i) => (
                <option key={`op-${i}`} value={op}>{op}</option>
              ))}
            </select>

            <select
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              className="value-select"
              disabled={!selectedVariable}
            >
              <option value="">Select Value*</option>
              {getValueOptions().map((val, i) => (
                <option key={`val-${i}`} value={val}>{val}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-section">
          <label>Action:</label>
          <div className="action-group">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setSelectedExercise('');
                setSets('');
                setReps('');
              }}
              className="action-select"
            >
              <option value="">Select Action*</option>
              {grammarOptions.actions.map((action, i) => (
                <option key={`act-${i}`} value={action}>{action.replace('_', ' ')}</option>
              ))}
            </select>

            {renderActionInputs()}
          </div>
        </div>

        <button 
          onClick={addRule}
          disabled={loading}
          className="submit-button"
        >
          {loading ? 'Saving...' : 'Add Rule'}
        </button>
      </div>

      <div className="saved-rules">
        <h3>Existing Rules</h3>
        {rules.length === 0 ? (
          <p className="no-rules">No rules defined yet</p>
        ) : (
          <ul className="rule-list">
            {rules.map((rule, index) => (
              <li key={`rule-${index}`} className="rule-item">
                {rule}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RulesManager;