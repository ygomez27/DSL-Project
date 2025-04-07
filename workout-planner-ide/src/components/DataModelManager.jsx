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
  const [newValidEntry, setNewValidEntry] = useState({
    type: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('validEntries');
  const [expandedSections, setExpandedSections] = useState({
    validEntries: true,
    recordTypes: true,
    records: true,
    typeAttributes: true
  });
  const [editAttributeForm, setEditAttributeForm] = useState({
    name: '',
    type: 'string',
    initial_value: ''
  });
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [showAttributeModal, setShowAttributeModal] = useState(false);

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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Valid Entries Handlers
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

  const handleDeleteEntry = async (type, name) => {
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'delete_valid_entry',
        payload: { type, name }
      });
      setSuccess('Entry deleted successfully');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete entry');
    }
  };

  // Record Type Handlers
  const handleAddRecordType = async () => {
    if (!newTypeName.trim()) {
      setError('Record type name is required');
      return;
    }

    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'add_record_type',
        payload: { name: newTypeName.trim() }
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

  // Attribute Handlers
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

  const handleEditAttribute = async (attributeId) => {
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'update_attribute',
        payload: {
          attribute_id: attributeId,
          ...editAttributeForm
        }
      });
      setSuccess('Attribute updated successfully');
      setError('');
      await fetchDataModel();
      setEditingAttribute(null);
      setShowAttributeModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update attribute');
      setSuccess('');
    }
  };

  const handleDeleteAttribute = async (attributeId) => {
    try {
      await axios.post('http://localhost:5000/update-datamodel', {
        action: 'delete_attribute',
        payload: { attribute_id: attributeId }
      });
      setSuccess('Attribute deleted successfully');
      setError('');
      await fetchDataModel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete attribute');
      setSuccess('');
    }
  };

  // Record Handlers
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
        payload: { record_id: recordId }
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

  // Render Components
  const renderTabs = () => (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'validEntries' ? 'active' : ''}`}
        onClick={() => setActiveTab('validEntries')}
      >
        Valid Entries
      </button>
      <button
        className={`tab ${activeTab === 'recordTypes' ? 'active' : ''}`}
        onClick={() => setActiveTab('recordTypes')}
      >
        Record Types
      </button>
      <button
        className={`tab ${activeTab === 'typeAttributes' ? 'active' : ''}`}
        onClick={() => setActiveTab('typeAttributes')}
      >
        Type Attributes
      </button>
      <button
        className={`tab ${activeTab === 'records' ? 'active' : ''}`}
        onClick={() => setActiveTab('records')}
      >
        Records
      </button>
    </div>
  );

  const renderValidEntries = () => (
    <div className="section-card">
      <div className="section-header" onClick={() => toggleSection('validEntries')}>
        <h2>Valid Entries</h2>
        <span>{expandedSections.validEntries ? '▼' : '▶'}</span>
      </div>
      {expandedSections.validEntries && (
        <>
          <div className="form-row">
            <select
              value={newValidEntry.type}
              onChange={(e) => setNewValidEntry({ ...newValidEntry, type: e.target.value })}
              className="input-field"
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
              className="input-field"
            />
            <button className="primary-btn" onClick={handleAddValidEntry}>
              Add Entry
            </button>
          </div>

          <div className="entries-grid">
            <div className="entry-group">
              <h3>Exercises</h3>
              <ul className="entry-list">
                {dataModel.exercise_names.map((ex, i) => (
                  <li key={i} className="entry-item">
                    {ex}
                    <button className="icon-btn danger" onClick={() => handleDeleteEntry('exercise', ex)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="entry-group">
              <h3>Goals</h3>
              <ul className="entry-list">
                {dataModel.goal_types.map((g, i) => (
                  <li key={i} className="entry-item">
                    {g}
                    <button className="icon-btn danger" onClick={() => handleDeleteEntry('goal', g)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="entry-group">
              <h3>Muscle Groups</h3>
              <ul className="entry-list">
                {dataModel.muscles.map((m, i) => (
                  <li key={i} className="entry-item">
                    {m}
                    <button className="icon-btn danger" onClick={() => handleDeleteEntry('muscle', m)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="entry-group">
              <h3>Fitness Levels</h3>
              <ul className="entry-list">
                {dataModel.levels.map((l, i) => (
                  <li key={i} className="entry-item">
                    {l}
                    <button className="icon-btn danger" onClick={() => handleDeleteEntry('level', l)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderRecordTypes = () => (
    <div className="section-card">
      <div className="section-header" onClick={() => toggleSection('recordTypes')}>
        <h2>Record Types</h2>
        <span>{expandedSections.recordTypes ? '▼' : '▶'}</span>
      </div>
      {expandedSections.recordTypes && (
        <>
          <div className="form-row">
            <input
              type="text"
              placeholder="New record type name"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              className="input-field"
            />
            <button className="primary-btn" onClick={handleAddRecordType}>
              Create Type
            </button>
          </div>

          <div className="type-cards">
            {Object.entries(dataModel.record_types).map(([typeName, typeDef]) => (
              <div key={typeName} className="type-card">
                <div className="card-header">
                  <h3>{typeName}</h3>
                </div>
                <table className="attr-table">
                  <thead>
                    <tr>
                      <th>Attribute</th>
                      <th>Type</th>
                      <th>Default</th>
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
        </>
      )}
    </div>
  );

  const renderRecordForm = () => {
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
              className="input-field"
              placeholder={attr.initial_value || `Enter ${attr.name}`}
            />
          </div>
        ))}
        <button className="primary-btn" onClick={handleAddRecord}>
          Add Record
        </button>
      </div>
    );
  };

  const renderRecordsTable = () => {
    const typeAttributes = dataModel.record_types[selectedType]?.attributes || [];
    const typeRecords = dataModel.records.filter(r => r.type_name === selectedType);

    return (
      <div className="records-table">
        <h3>{selectedType} Records</h3>
        {typeRecords.length === 0 ? (
          <p>No records found</p>
        ) : (
          <table className="attr-table">
            <thead>
              <tr>
                <th>ID</th>
                {typeAttributes.map(attr => <th key={attr.name}>{attr.name}</th>)}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {typeRecords.map(record => (
                <tr key={record.id} onClick={() => handleRecordSelect(record)}>
                  <td>{record.id}</td>
                  {typeAttributes.map(attr => (
                    <td key={attr.name}>{record.values[attr.name] || '-'}</td>
                  ))}
                  <td>
                    <button
                      className="icon-btn danger"
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
        )}
      </div>
    );
  };

  const renderTypeAttributes = () => (
    <div className="section-card">
      <div className="section-header" onClick={() => toggleSection('typeAttributes')}>
        <h2>Type Attributes Management</h2>
        <span>{expandedSections.typeAttributes ? '▼' : '▶'}</span>
      </div>
      {expandedSections.typeAttributes && (
        <div className="attribute-management">
          <div className="form-grid">
            <div className="form-group">
              <label>Record Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="input-field"
              >
                <option value="">Select Record Type</option>
                {Object.keys(dataModel.record_types).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
  
            <div className="form-group">
              <label>Attribute Name</label>
              <input
                type="text"
                value={newAttribute.name}
                onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
                className="input-field"
                placeholder="Enter attribute name"
              />
            </div>
  
            <div className="form-group">
              <label>Data Type</label>
              <select
                value={newAttribute.type}
                onChange={(e) => setNewAttribute({ ...newAttribute, type: e.target.value })}
                className="input-field"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>
  
            <div className="form-group">
              <label>Default Value</label>
              <input
                type="text"
                value={newAttribute.initial_value}
                onChange={(e) => setNewAttribute({ ...newAttribute, initial_value: e.target.value })}
                className="input-field"
                placeholder="Optional default value"
              />
            </div>
          </div>
  
          <button
            className="primary-btn"
            onClick={handleAddAttribute}
            disabled={!selectedType || !newAttribute.name.trim()}
          >
            Add Attribute
          </button>
  
          {selectedType && dataModel.record_types[selectedType]?.attributes?.length > 0 && (
            <div className="existing-attributes">
              <h3>Current Attributes in {selectedType}</h3>
              <table className="attr-table">
                <thead>
                  <tr>
                    <th>Attribute</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dataModel.record_types[selectedType].attributes.map((attr, index) => (
                    <tr key={attr.id || index}>
                      <td>{attr.name}</td>
                      <td>{attr.type}</td>
                      <td>{attr.initial_value || '-'}</td>
                      <td>
                        <button
                          className="icon-btn edit"
                          onClick={() => {
                            setEditingAttribute(attr.id);
                            setEditAttributeForm({
                              name: attr.name,
                              type: attr.type,
                              initial_value: attr.initial_value || ''
                            });
                            setShowAttributeModal(true);
                          }}
                          title="Edit attribute"
                        >
                          ✎
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => handleDeleteAttribute(attr.id)}
                          title="Delete attribute"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderEditModal = () => (
    selectedRecord && (
      <div className="modal-overlay">
        <div className="edit-modal">
          <h3>Edit Record</h3>
          {dataModel.record_types[selectedRecord.type_name]?.attributes.map(attr => (
            <div key={attr.name} className="form-field">
              <label>{attr.name} ({attr.type})</label>
              <input
                type={attr.type === 'number' ? 'number' : 'text'}
                value={editRecordValues[attr.name] || ''}
                onChange={(e) => setEditRecordValues({
                  ...editRecordValues,
                  [attr.name]: e.target.value
                })}
                className="input-field"
              />
            </div>
          ))}
          <div className="form-actions">
            <button className="primary-btn" onClick={handleUpdateRecord}>
              Save Changes
            </button>
            <button className="primary-btn" onClick={() => setSelectedRecord(null)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  );

  const renderAttributeModal = () => (
    showAttributeModal && editingAttribute && (
      <div className="modal-overlay">
        <div className="edit-modal">
          <h3>Edit Attribute</h3>
          <div className="form-field">
            <label>Attribute Name</label>
            <input
              type="text"
              value={editAttributeForm.name}
              onChange={(e) => setEditAttributeForm({ 
                ...editAttributeForm, 
                name: e.target.value 
              })}
              className="input-field"
            />
          </div>
          <div className="form-field">
            <label>Data Type</label>
            <select
              value={editAttributeForm.type}
              onChange={(e) => setEditAttributeForm({ 
                ...editAttributeForm, 
                type: e.target.value 
              })}
              className="input-field"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>
          </div>
          <div className="form-field">
            <label>Default Value</label>
            <input
              type="text"
              value={editAttributeForm.initial_value}
              onChange={(e) => setEditAttributeForm({ 
                ...editAttributeForm, 
                initial_value: e.target.value 
              })}
              className="input-field"
            />
          </div>
          <div className="form-actions">
            <button 
              className="primary-btn" 
              onClick={() => {
                handleEditAttribute(editingAttribute);
                setShowAttributeModal(false);
              }}
            >
              Save Changes
            </button>
            <button 
              className="primary-btn" 
              onClick={() => {
                setShowAttributeModal(false);
                setEditingAttribute(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  );

  const renderRecordsManager = () => (
    <div className="section-card">
      <div className="section-header" onClick={() => toggleSection('records')}>
        <h2>Records Management</h2>
        <span>{expandedSections.records ? '▼' : '▶'}</span>
      </div>
      {expandedSections.records && (
        <>
          <div className="form-row">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input-field"
            >
              <option value="">Select Record Type</option>
              {Object.keys(dataModel.record_types).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {selectedType && (
            <div className="record-interface">
              {renderRecordForm()}
              {renderRecordsTable()}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="content">
      <h1 className="page-title">Data Model Manager</h1>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {renderTabs()}

      <div className="content-area">
        {activeTab === 'validEntries' && renderValidEntries()}
        {activeTab === 'recordTypes' && renderRecordTypes()}
        {activeTab === 'typeAttributes' && renderTypeAttributes()}
        {activeTab === 'records' && renderRecordsManager()}
      </div>

      {renderEditModal()}
      {renderAttributeModal()}
    </div>
  );
};

export default DataModelManager;