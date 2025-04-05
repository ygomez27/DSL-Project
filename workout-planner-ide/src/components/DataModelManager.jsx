import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DataModelManager = () => {
  const [dataModel, setDataModel] = useState({ 
    record_types: {}, 
    records: [],
    exercise_names: [],
    goal_types: [],
    muscles: [],
    levels: []
  });
  const [selectedType, setSelectedType] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newAttribute, setNewAttribute] = useState({ 
    name: '', 
    type: 'string', 
    initial_value: '' 
  });
  const [newRecord, setNewRecord] = useState({});
  const [editRecordValues, setEditRecordValues] = useState({});
  const [action, setAction] = useState('add_attribute');
  const [newValidEntry, setNewValidEntry] = useState({
    type: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDataModel();
  }, []);

  const fetchDataModel = async () => {
    try {
      const response = await axios.get('http://localhost:5000/get-datamodel');
      setDataModel(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load data model');
      console.error('Error fetching data model', err);
    }
  };

  const handleAddValidEntry = async () => {
    if (!newValidEntry.type || !newValidEntry.name.trim()) {
      setError('Type and name are required');
      return;
    }
    
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'add_valid_entry',
        payload: {
          type: newValidEntry.type,
          name: newValidEntry.name.trim()
        }
      });
      setNewValidEntry({ type: '', name: '' });
      setSuccess('Entry added successfully');
      setError('');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add entry');
      setSuccess('');
    }
  };

  const handleAddRecordType = async () => {
    if (!newTypeName.trim()) {
      setError('Record type name is required');
      return;
    }
    
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'add_record_type',
        payload: {
          name: newTypeName.trim()
        }
      });
      setNewTypeName('');
      setSuccess('Record type added successfully');
      setError('');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add record type');
      setSuccess('');
    }
  };

  const handleAddAttribute = async () => {
    if (!selectedType || !newAttribute.name.trim()) {
      setError('Record type and attribute name are required');
      return;
    }
    
    try {
      const typeId = dataModel.record_types[selectedType]?.id;
      if (!typeId) {
        setError('Invalid record type');
        return;
      }
      
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'add_attribute',
        payload: {
          type_id: typeId,
          name: newAttribute.name.trim(),
          type: newAttribute.type,
          initial_value: newAttribute.initial_value
        }
      });
      setNewAttribute({ name: '', type: 'string', initial_value: '' });
      setSuccess('Attribute added successfully');
      setError('');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add attribute');
      setSuccess('');
    }
  };

  const handleAddRecord = async () => {
    if (!selectedType) {
      setError('Please select a record type');
      return;
    }
    
    try {
      const typeId = dataModel.record_types[selectedType]?.id;
      if (!typeId) {
        setError('Invalid record type');
        return;
      }
      
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'add_record',
        payload: {
          type_id: typeId,
          values: newRecord
        }
      });
      setNewRecord({});
      setSuccess('Record added successfully');
      setError('');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add record');
      setSuccess('');
    }
  };

  const handleUpdateRecord = async () => {
    if (!selectedRecord) {
      setError('No record selected');
      return;
    }
    
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'update_record',
        payload: {
          record_id: selectedRecord.id,
          values: editRecordValues
        }
      });
      setEditRecordValues({});
      setSelectedRecord(null);
      setSuccess('Record updated successfully');
      setError('');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update record');
      setSuccess('');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'delete_record',
        payload: {
          record_id: recordId
        }
      });
      setSuccess('Record deleted successfully');
      setError('');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete record');
      setSuccess('');
    }
  };

  const handleRecordSelect = (record) => {
    setSelectedRecord(record);
    setEditRecordValues({ ...record.values });
  };

  const renderValidEntriesManagement = () => (
    <div className="valid-entries-management">
      <h2>Manage Valid Entries</h2>
      <div className="add-valid-entry">
        <select
          value={newValidEntry.type}
          onChange={(e) => setNewValidEntry({ ...newValidEntry, type: e.target.value })}
        >
          <option value="">Select Entry Type</option>
          <option value="exercise">Exercise</option>
          <option value="goal">Goal</option>
          <option value="muscle">Muscle Group</option>
          <option value="level">Fitness Level</option>
        </select>
        <input
          type="text"
          placeholder="Entry name"
          value={newValidEntry.name}
          onChange={(e) => setNewValidEntry({ ...newValidEntry, name: e.target.value })}
        />
        <button onClick={handleAddValidEntry}>Add Entry</button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="current-entries">
        <div className="entry-group">
          <h3>Valid Exercises</h3>
          <ul>
            {dataModel.exercise_names.map((ex, i) => (
              <li key={i}>{ex}</li>
            ))}
          </ul>
        </div>
        <div className="entry-group">
          <h3>Valid Goals</h3>
          <ul>
            {dataModel.goal_types.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
        <div className="entry-group">
          <h3>Valid Muscle Groups</h3>
          <ul>
            {dataModel.muscles.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
        <div className="entry-group">
          <h3>Valid Fitness Levels</h3>
          <ul>
            {dataModel.levels.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderAttributeForm = () => (
    <div className="attribute-form">
      <h3>Add New Attribute</h3>
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
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
      </select>
      <input
        type="text"
        placeholder="Initial value (optional)"
        value={newAttribute.initial_value}
        onChange={(e) => setNewAttribute({ ...newAttribute, initial_value: e.target.value })}
      />
      <button onClick={handleAddAttribute}>
        Add Attribute to {selectedType}
      </button>
    </div>
  );

  const renderRecordForm = () => {
    if (!selectedType) return null;
    
    const typeAttributes = dataModel.record_types[selectedType]?.attributes || [];
    
    return (
      <div className="record-form">
        <h3>Add New {selectedType} Record</h3>
        {typeAttributes.map(attr => (
          <div key={attr.name} className="form-field">
            <label>{attr.name} ({attr.type})</label>
            <input
              type={attr.type === 'number' ? 'number' : 'text'}
              value={newRecord[attr.name] || ''}
              onChange={(e) => setNewRecord({ 
                ...newRecord, 
                [attr.name]: e.target.value 
              })}
              placeholder={attr.initial_value || `Enter ${attr.name}`}
            />
          </div>
        ))}
        <button onClick={handleAddRecord}>Add Record</button>
      </div>
    );
  };

  const renderEditRecordForm = () => {
    if (!selectedRecord) return null;
    
    const recordType = dataModel.record_types[selectedRecord.type_name];
    if (!recordType) return null;
    
    return (
      <div className="edit-record-form">
        <h3>Edit Record</h3>
        {recordType.attributes.map(attr => (
          <div key={attr.name} className="form-field">
            <label>{attr.name} ({attr.type})</label>
            <input
              type={attr.type === 'number' ? 'number' : 'text'}
              value={editRecordValues[attr.name] || ''}
              onChange={(e) => setEditRecordValues({ 
                ...editRecordValues, 
                [attr.name]: e.target.value 
              })}
            />
          </div>
        ))}
        <div className="form-actions">
          <button onClick={handleUpdateRecord}>Save Changes</button>
          <button onClick={() => setSelectedRecord(null)}>Cancel</button>
        </div>
      </div>
    );
  };

  const renderRecordsTable = () => {
    if (!selectedType) return null;
    
    const typeAttributes = dataModel.record_types[selectedType]?.attributes || [];
    const typeRecords = dataModel.records.filter(
      r => r.type_name === selectedType
    );
    
    if (typeRecords.length === 0) {
      return <p>No records of this type exist yet.</p>;
    }
    
    return (
      <div className="records-table">
        <h3>{selectedType} Records</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              {typeAttributes.map(attr => (
                <th key={attr.name}>{attr.name}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {typeRecords.map(record => (
              <tr 
                key={record.id} 
                className={selectedRecord?.id === record.id ? 'selected' : ''}
                onClick={() => handleRecordSelect(record)}
              >
                <td>{record.id}</td>
                {typeAttributes.map(attr => (
                  <td key={attr.name}>
                    {record.values[attr.name] || '-'}
                  </td>
                ))}
                <td>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRecord(record.id);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="data-model-container">
      <h1>Data Model Manager</h1>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="action-selector">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="add_attribute">Add Attribute</option>
          <option value="add_record_type">Add Record Type</option>
          <option value="manage_records">Manage Records</option>
          <option value="manage_valid_entries">Manage Valid Entries</option>
        </select>
      </div>

      {action === 'manage_valid_entries' && renderValidEntriesManagement()}

      {action === 'add_record_type' && (
        <div className="type-creation">
          <h2>Create New Record Type</h2>
          <input
            type="text"
            placeholder="New type name"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
          />
          <button onClick={handleAddRecordType}>
            Create Record Type
          </button>
        </div>
      )}

      {action === 'add_attribute' && (
        <div className="type-management">
          <h2>Manage Attributes</h2>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">Select Record Type</option>
            {Object.keys(dataModel.record_types).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          {selectedType && renderAttributeForm()}
        </div>
      )}

      {action === 'manage_records' && (
        <div className="records-management">
          <h2>Manage Records</h2>
          <select 
            value={selectedType} 
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedRecord(null);
            }}
          >
            <option value="">Select Record Type</option>
            {Object.keys(dataModel.record_types).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          {selectedType && (
            <>
              {renderRecordForm()}
              {renderRecordsTable()}
              {selectedRecord && renderEditRecordForm()}
            </>
          )}
        </div>
      )}

      <div className="record-types-overview">
        <h2>Current Data Model</h2>
        {Object.entries(dataModel.record_types).map(([typeName, typeDef]) => (
          <div key={typeName} className="record-type-card">
            <h3>{typeName}</h3>
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
                    <td>{attr.initial_value || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataModelManager;