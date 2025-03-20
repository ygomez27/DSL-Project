import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DataModelManager = () => {
  const [dataModel, setDataModel] = useState({ record_types: {}, records: {} });
  const [selectedType, setSelectedType] = useState('');
  const [newAttribute, setNewAttribute] = useState({ name: '', type: 'String', initial: '' });

  useEffect(() => {
    const fetchDataModel = async () => {
      try {
        const response = await axios.get('http://localhost:5000/get-datamodel');
        setDataModel(response.data);
      } catch (error) {
        console.error('Error fetching data model', error);
      }
    };
    fetchDataModel();
  }, []);

  const handleAddAttribute = async () => {
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        record_type: selectedType,
        attribute: newAttribute
      });
      setNewAttribute({ name: '', type: 'String', initial: '' });
      const response = await axios.get('http://localhost:5000/get-datamodel');
      setDataModel(response.data);
    } catch (error) {
      console.error('Error adding attribute', error);
    }
  };

  return (
    <div className="data-model-container">
      <h1>Data Model Definition</h1>
      
      <div className="record-types">
        {Object.entries(dataModel.record_types).map(([typeName, typeDef]) => (
          <div key={typeName} className="record-type-card">
            <h3>{typeName} Record Type</h3>
            
            <table>
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Type</th>
                  <th>Initial Value</th>
                </tr>
              </thead>
              <tbody>
                {typeDef.attributes.map((attr, index) => (
                  <tr key={index}>
                    <td>{attr.name}</td>
                    <td>{attr.type}</td>
                    <td>{attr.initial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="type-management">
        <h2>Manage Record Types</h2>
        <select onChange={(e) => setSelectedType(e.target.value)}>
          <option value="">Select Record Type</option>
          {Object.keys(dataModel.record_types).map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <div className="attribute-form">
          <input
            type="text"
            placeholder="Attribute name"
            value={newAttribute.name}
            onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
          />
          <select
            value={newAttribute.type}
            onChange={(e) => setNewAttribute({ ...newAttribute, type: e.target.value })}
          >
            <option value="String">String</option>
            <option value="Integer">Integer</option>
            <option value="Time">Time</option>
            <option value="DayOfWeek">DayOfWeek</option>
            <option value="MuscleGroup">MuscleGroup</option>
            <option value="GoalType">GoalType</option>
          </select>
          <input
            type="text"
            placeholder="Initial value (optional)"
            value={newAttribute.initial}
            onChange={(e) => setNewAttribute({ ...newAttribute, initial: e.target.value })}
          />
          <button onClick={handleAddAttribute}>
            Add Attribute to {selectedType}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataModelManager;