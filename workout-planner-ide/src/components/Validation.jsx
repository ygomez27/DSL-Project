import React, { useState } from 'react';
import axios from 'axios';

const Validation = () => {
  const [rule, setRule] = useState('');
  const [validationResult, setValidationResult] = useState({});
  const [errors, setErrors] = useState([]);

  const validateRule = async () => {
    setValidationResult({});
    setErrors([]);

    if (!rule.trim()) {
      setValidationResult({
        status: 'error',
        message: 'Please enter a rule before validating'
      });
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/validate-rule', 
        { rule: rule },
        { headers: { 'Content-Type': 'application/json' } }
      );

      setValidationResult(response.data);
      setErrors(response.data.errors || []);

    } catch (error) {
      if (error.response) {
        if (error.response.status === 405) {
          setValidationResult({
            status: 'error',
            message: 'Invalid request method. Please use POST'
          });
        } else {
          setValidationResult(error.response.data);
          setErrors(error.response.data.errors || []);
        }
      } else if (error.request) {
        setValidationResult({
          status: 'error',
          message: 'No response from server. Check backend connection'
        });
      } else {
        setValidationResult({
          status: 'error',
          message: `Validation failed: ${error.message}`
        });
      }
    }
  };

  return (
    <div className="validation-container">
      <h2>Rule Validation</h2>
      
      <div className="editor-section">
        <textarea
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          placeholder={`Example valid rule:\nrule 1 if muscle_group == "Chest" then include_exercise "Bench Press"`}
          rows={8}
          className={validationResult.status === 'invalid' ? 'error-border' : ''}
        />
        <button onClick={validateRule}>Validate Rule</button>
      </div>

      {validationResult.status && (
        <div className={`result-card ${validationResult.status}`}>
          <h3>Validation Result: {validationResult.status.toUpperCase()}</h3>
          <p>{validationResult.message}</p>

          {validationResult.location && (
            <div className="error-location">
              Line {validationResult.location.line}, Column {validationResult.location.column}
            </div>
          )}

          {errors.length > 0 && (
            <div className="error-list">
              <h4>Issues Found:</h4>
              <ul>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.status === 'valid' && validationResult.parsed && (
            <div className="parsed-result">
              <h4>Parsed Structure:</h4>
              <div className="parsed-details">
                <p><strong>Rule Name:</strong> {validationResult.parsed.name}</p>
                <p><strong>Conditions:</strong></p>
                <ul>
                  {validationResult.parsed.conditions.map((condition, index) => (
                    <li key={index}>{condition}</li>
                  ))}
                </ul>
                <p><strong>Action:</strong> {validationResult.parsed.action}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Validation;