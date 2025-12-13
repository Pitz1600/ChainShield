import React, { useEffect, useRef } from 'react';
import '../styles/TransactionGraph.css';

function TransactionGraph() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 600;

    const nodes = [
      { x: 300, y: 300, label: '0x1234', risk: 'high', type: 'source' },
      { x: 500, y: 200, label: '0xabcd', risk: 'medium', type: 'intermediate' },
      { x: 700, y: 300, label: '0xef56', risk: 'low', type: 'destination' },
      { x: 500, y: 400, label: '0x7890', risk: 'critical', type: 'intermediate' },
      { x: 700, y: 500, label: '0xdef0', risk: 'high', type: 'destination' }
    ];

    const edges = [
      { from: 0, to: 1, amount: '50K' },
      { from: 1, to: 2, amount: '30K' },
      { from: 0, to: 3, amount: '75K' },
      { from: 3, to: 4, amount: '60K' }
    ];

    const getRiskColor = (risk) => {
      const colors = {
        critical: '#dc2626',
        high: '#ea580c',
        medium: '#ca8a04',
        low: '#2563eb'
      };
      return colors[risk] || '#6b7280';
    };

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    edges.forEach(edge => {
      const from = nodes[edge.from];
      const to = nodes[edge.to];
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      ctx.fillStyle = '#475569';
      ctx.font = '12px sans-serif';
      ctx.fillText(edge.amount, midX, midY);
    });

    nodes.forEach(node => {
      ctx.fillStyle = getRiskColor(node.risk);
      ctx.beginPath();
      ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + 4);
    });
  }, []);

  return (
    <div className="graph-container">
      <div className="graph-header">
        <div className="graph-title-wrapper">
          <span className="graph-icon">🕸️</span>
          <div className="graph-title-group">
            <h3 className="graph-title">Transaction Network Graph</h3>
            <p className="graph-subtitle">Visualize relationships between addresses</p>
          </div>
        </div>
        <div className="graph-controls">
          <button className="graph-control-btn">🔍+</button>
          <button className="graph-control-btn">🔍-</button>
          <button className="graph-control-btn">🔄</button>
        </div>
      </div>

      <canvas ref={canvasRef} className="graph-canvas" />

      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-color critical"></div>
          <span className="legend-label">Critical Risk</span>
        </div>
        <div className="legend-item">
          <div className="legend-color high"></div>
          <span className="legend-label">High Risk</span>
        </div>
        <div className="legend-item">
          <div className="legend-color medium"></div>
          <span className="legend-label">Medium Risk</span>
        </div>
        <div className="legend-item">
          <div className="legend-color low"></div>
          <span className="legend-label">Low Risk</span>
        </div>
      </div>
    </div>
  );
}

export default TransactionGraph;