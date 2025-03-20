import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import RulesManager from './components/RulesManager';
import DataModelManager from './components/DataModelManager';
import Validation from './components/Validation';
import History from './components/History';
import './CSS/general.css';

function App() {
  const [selectedSection, setSelectedSection] = useState('Goal Rules');

  const renderSection = () => {
    switch (selectedSection) {
      case 'Goal Rules':
      case 'Exercise Rules':
        return <RulesManager section={selectedSection} />;
      case 'Exercises':
      case 'Workout Plans':
        return <DataModelManager section={selectedSection} />;
      case 'Validation':
        return <Validation />;
      case 'History':
        return <History />;
      default:
        return <div>Select a section</div>;
    }
  };

  return (
    <div className="main-container">
      <Sidebar selectedSection={selectedSection} setSelectedSection={setSelectedSection} />
      <div className="content">
        {renderSection()}
      </div>
    </div>
  );
}

export default App;