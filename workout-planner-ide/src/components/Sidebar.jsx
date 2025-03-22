import React from 'react';

const Sidebar = ({ selectedSection, setSelectedSection }) => {
  return (
    <div className="sidebar">
      <h2>Workout Planner DSL</h2>


      <ul>
        <strong>Business Rules</strong>

        <li onClick={() => setSelectedSection('Goal Rules')}>
          Goal Rules
        </li>


        <li onClick={() => setSelectedSection('Exercise Rules')}>
          Exercise Rules
        </li>


        <strong>Data Model</strong>


        <li onClick={() => setSelectedSection('Exercises')}>
          Exercises
        </li>







        <li style={{ fontWeight: selectedSection === 'Validation' ? 'bold' : 'normal' }}
          onClick={() => setSelectedSection('Validation')}
        >
          Validation
        </li>
        <li className="active"
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