import React, { useState, useEffect } from 'react';
import axios from 'axios';

const History = () => {
  const [history, setHistory] = useState([]);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get('http://localhost:5000/get-history');
        setHistory(response.data.history);
      } catch (error) {
        console.error('Error fetching history', error);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div>
      <h2>History</h2>
      <ul>
        {history.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

export default History;