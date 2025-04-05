import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RulesManager = ({ section }) => {
  const [rules, setRules] = useState([]);
  const [grammar, setGrammar] = useState({
    variables: [],
    operators: [],
    actions: [],
    exercise_names: [],
    goal_types: [],
    muscles: [],
    levels: []
  });
  const [form, setForm] = useState({
    conditions: [],
    selectedVariable: '',
    selectedOperator: '',
    selectedValue: '',
    actionType: '',
    exercise: '',
    sets: 3,
    reps: 8,
    minRest: 60,
    maxRest: 120
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [grammarRes, rulesRes] = await Promise.all([
          axios.get('http://localhost:5000/analyze-grammar'),
          axios.get('http://localhost:5000/get-rules')
        ]);

        // Format variables for display
        const formattedVars = grammarRes.data.variables.map(v => ({
          raw: v,
          display: v.includes('.')
            ? `${v.split('.')[0]}: ${v.split('.')[1]}`
            : v
        }));

        setGrammar({
          ...grammarRes.data,
          variables: formattedVars
        });
        setRules(rulesRes.data.rules);
      } catch (err) {
        setError('Failed to load data');
      }
    };
    loadData();
  }, [section]);

  const handleAddCondition = () => {
    if (!form.selectedVariable || !form.selectedOperator || !form.selectedValue) {
      setError('All condition fields are required');
      return;
    }

    // Find raw variable value
    const variable = grammar.variables.find(
      v => v.display === form.selectedVariable
    )?.raw || form.selectedVariable;

    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        variable,
        operator: form.selectedOperator,
        value: form.selectedValue
      }],
      selectedVariable: '',
      selectedOperator: '',
      selectedValue: ''
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      // Format rule text
      const conditionsText = form.conditions.map(cond => {
        const value = isNaN(cond.value) ? `"${cond.value}"` : cond.value;
        return `${cond.variable} ${cond.operator} ${value}`;
      }).join(' and ');

      const actionText = form.actionType === 'include_exercise'
        ? `include_exercise "${form.exercise}"`
        : form.actionType === 'sets'
        ? `sets ${form.sets} reps ${form.reps}`
        : `set_rest_time min ${form.minRest}s max ${form.maxRest}s`;

      const ruleText = `rule Rule${rules.length + 1} if ${conditionsText} then ${actionText}`;

      // Validate and submit
      await axios.post('http://localhost:5000/validate-rule', { rule: ruleText });
      const res = await axios.post('http://localhost:5000/add-rule', { rule: ruleText });

      setRules([...rules, res.data.rule]);
      setForm({
        conditions: [],
        selectedVariable: '',
        selectedOperator: '',
        selectedValue: '',
        actionType: '',
        exercise: '',
        sets: 3,
        reps: 8,
        minRest: 60,
        maxRest: 120
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  const formatVariable = (variable) => {
    // Handle legacy textX format
    if (typeof variable === 'string' && variable.startsWith('<textx:')) {
      const match = variable.match(/record_type=['"](.*?)['"], field=['"](.*?)['"]/);
      return match ? `${match[1]}: ${match[2]}` : 'Invalid variable';
    }

    // Handle new format
    if (variable.includes('.')) {
      const [type, field] = variable.split('.');
      return `${type}: ${field}`;
    }

    return variable;
  };

  return (
    <div className="rules-manager">
      <h2>{section} Rules</h2>

      {/* Error Display */}
      {error && <div className="error">{error}</div>}

      {/* Condition Builder */}
      <div className="condition-builder">
        <h3>Build Conditions</h3>
        <div className="condition-fields">
          <select
            value={form.selectedVariable}
            onChange={e => setForm(p => ({ ...p, selectedVariable: e.target.value }))}
          >
            <option value="">Select Variable</option>
            {grammar.variables.map(v => (
              <option key={v.raw} value={v.display}>
                {v.display}
              </option>
            ))}
          </select>

          <select
            value={form.selectedOperator}
            onChange={e => setForm(p => ({ ...p, selectedOperator: e.target.value }))}
          >
            <option value="">Select Operator</option>
            {grammar.operators.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>

          {/* Value Input */}
          {['goal', 'muscle_group', 'fitness_level'].includes(
            grammar.variables.find(v => v.display === form.selectedVariable)?.raw.split('.')[0]
          ) ? (
            <select
              value={form.selectedValue}
              onChange={e => setForm(p => ({ ...p, selectedValue: e.target.value }))}
            >
              <option value="">Select Value</option>
              {(() => {
                const varType = grammar.variables.find(
                  v => v.display === form.selectedVariable
                )?.raw.split('.')[0];
                return grammar[{
                  goal: 'goal_types',
                  muscle_group: 'muscles',
                  fitness_level: 'levels'
                }[varType]]?.map(v => (
                  <option key={v} value={v}>{v}</option>
                ));
              })()}
            </select>
          ) : (
            <input
              type={['age', 'duration'].includes(
                grammar.variables.find(v => v.display === form.selectedVariable)?.raw
              ) ? 'number' : 'text'}
              value={form.selectedValue}
              onChange={e => setForm(p => ({ ...p, selectedValue: e.target.value }))}
              placeholder="Enter value"
            />
          )}
        </div>
        <button onClick={handleAddCondition}>Add Condition</button>
      </div>

      {/* Active Conditions */}
      <div className="active-conditions">
        <h4>Current Conditions</h4>
        {form.conditions.map((cond, i) => (
          <div key={i} className="condition">
            <span className="variable">{formatVariable(cond.variable)}</span>
            <span className="operator">{cond.operator}</span>
            <span className="value">{cond.value}</span>
            <button onClick={() => setForm(p => ({
              ...p,
              conditions: p.conditions.filter((_, idx) => idx !== i)
            }))}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Action Configuration */}
      <div className="action-config">
        <h3>Configure Action</h3>
        <select
          value={form.actionType}
          onChange={e => setForm(p => ({ ...p, actionType: e.target.value }))}
        >
          <option value="">Select Action Type</option>
          {grammar.actions.map(action => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>

        {/* Action Inputs */}
        {form.actionType === 'include_exercise' && (
          <select
            value={form.exercise}
            onChange={e => setForm(p => ({ ...p, exercise: e.target.value }))}
          >
            <option value="">Select Exercise</option>
            {grammar.exercise_names.map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        )}

        {form.actionType === 'sets' && (
          <div className="sets-reps">
            <input
              type="number"
              min="1"
              max="10"
              value={form.sets}
              onChange={e => setForm(p => ({ ...p, sets: e.target.value }))}
            />
            <span>sets ×</span>
            <input
              type="number"
              min="1"
              max="20"
              value={form.reps}
              onChange={e => setForm(p => ({ ...p, reps: e.target.value }))}
            />
            <span>reps</span>
          </div>
        )}

        {form.actionType === 'set_rest_time' && (
          <div className="rest-time">
            <input
              type="number"
              min="30"
              max="300"
              value={form.minRest}
              onChange={e => setForm(p => ({ ...p, minRest: e.target.value }))}
            />
            <span>to</span>
            <input
              type="number"
              min="60"
              max="600"
              value={form.maxRest}
              onChange={e => setForm(p => ({ ...p, maxRest: e.target.value }))}
            />
            <span>seconds</span>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !form.conditions.length || !form.actionType}
      >
        {loading ? 'Creating...' : 'Create Rule'}
      </button>

      {/* Rules List */}
      <div className="rules-list">
        <h3>Active Rules</h3>
        {rules.map(rule => (
          <div key={rule.id} className="rule-card">
            <div className="rule-header">
              <h4>{rule.name}</h4>
              <span>ID: {rule.id}</span>
            </div>

            <div className="conditions">
              <h5>Conditions</h5>
              {rule.conditions.map((cond, i) => (
                <div key={i} className="condition">
                  <span className="variable">{formatVariable(cond.variable)}</span>
                  <span className="operator">{cond.operator}</span>
                  <span className="value">{cond.value}</span>
                </div>
              ))}
            </div>

            <div className="actions">
              <h5>Actions</h5>
              {rule.actions.map((action, i) => (
                <div key={i} className="action">
                  {action.action_type === 'include_exercise' && (
                    <span>Add: {action.exercise_name}</span>
                  )}
                  {action.action_type === 'sets_reps' && (
                    <span>{action.sets_count} sets × {action.reps_count} reps</span>
                  )}
                  {action.action_type === 'rest_time' && (
                    <span>Rest: {action.min_rest_time}-{action.max_rest_time}s</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RulesManager;