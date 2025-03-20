import React from 'react';

const Sidebar = ({ selectedSection, setSelectedSection }) => {
  return (
    <div className="sidebar">
      <h2>Workout Planner DSL</h2>
      <ul>
        <li>
          <strong>Business Rules</strong>
          <ul>
            <li
              style={{ fontWeight: selectedSection === 'Goal Rules' ? 'bold' : 'normal' }}
              onClick={() => setSelectedSection('Goal Rules')}
            >
              Goal Rules
            </li>
            <li
              style={{ fontWeight: selectedSection === 'Exercise Rules' ? 'bold' : 'normal' }}
              onClick={() => setSelectedSection('Exercise Rules')}
            >
              Exercise Rules
            </li>
          </ul>
        </li>
        <li>
          <strong>Data Model</strong>
          <ul>
            <li
              style={{ fontWeight: selectedSection === 'Exercises' ? 'bold' : 'normal' }}
              onClick={() => setSelectedSection('Exercises')}
            >
              Exercises
            </li>
          </ul>
        </li>
        <li
          style={{ fontWeight: selectedSection === 'Validation' ? 'bold' : 'normal' }}
          onClick={() => setSelectedSection('Validation')}
        >
          Validation
        </li>
        <li
          style={{ fontWeight: selectedSection === 'History' ? 'bold' : 'normal' }}
          onClick={() => setSelectedSection('History')}
        >
          History
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;