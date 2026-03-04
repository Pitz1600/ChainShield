"""
ChainShield Graph Analytics Service
Detects fraud patterns using network analysis (NetworkX)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
import json
from collections import defaultdict
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# Global transaction graph
G = nx.DiGraph()  # Directed graph for transaction flow

# Transaction history for temporal analysis
transaction_history = []

# Node risk cache for propagation
node_risk = defaultdict(float)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'nodes': G.number_of_nodes(),
        'edges': G.number_of_edges()
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Analyze transaction for fraud patterns using graph analytics
    Expected input:
    {
        "transaction": {
            "fromAddress": "...",
            "toAddress": "...",
            "amount": 50000,
            "timestamp": "...",
            "transactionType": "Social Welfare"
        }
    }
    """
    try:
        data = request.json
        transaction = data.get('transaction', {})
        result = analyze_single(transaction)
        return jsonify(result)
    except Exception as e:
        print(f"Graph analysis error: {e}")
        return jsonify({
            'error': str(e),
            'networkFeatures': {},
            'fraudPatterns': [],
            'graphRisk': 0
        }), 500


@app.route('/batch/analyze', methods=['POST'])
def analyze_batch():
    """Batch graph analysis with risk propagation"""
    try:
        payload = request.json or {}
        txs = payload.get('transactions', [])
        results = []

        for tx in txs:
            res = analyze_single(tx, commit=True)
            results.append(res)

        # propagate risk from high-risk nodes
        propagate_risk(node_risk)

        # attach propagated risk for nodes in batch
        for res in results:
            from_addr = res.get('addresses', {}).get('from')
            to_addr = res.get('addresses', {}).get('to')
            propagated = max(node_risk.get(from_addr, 0) * 0.5, node_risk.get(to_addr, 0) * 0.5)
            res['propagatedRisk'] = round(propagated, 3)
            res['graphRisk'] = min(1.0, res.get('graphRisk', 0) + propagated)

        return jsonify({
            'results': results,
            'graphStats': {
                'totalNodes': G.number_of_nodes(),
                'totalEdges': G.number_of_edges()
            }
        })
    except Exception as e:
        print(f"Batch graph analysis error: {e}")
        return jsonify({'error': str(e), 'results': []}), 500

def analyze_single(transaction, commit=True):
    from_addr = transaction.get('fromAddress', '')
    to_addr = transaction.get('toAddress', '')
    amount = float(transaction.get('amount', 0))
    timestamp = transaction.get('timestamp', datetime.now().isoformat())
    tx_type = transaction.get('transactionType', 'Other')

    if not from_addr or not to_addr:
        raise ValueError('Missing fromAddress or toAddress')

    if commit:
        add_edge(from_addr, to_addr, amount, timestamp, tx_type)

    network_features = calculate_network_features(from_addr, to_addr)
    fraud_patterns, risk = detect_fraud_patterns(from_addr, to_addr, amount, tx_type, timestamp)
    node_risk[to_addr] = max(node_risk[to_addr], risk)
    node_risk[from_addr] = max(node_risk[from_addr], risk * 0.5)

    return {
        'addresses': {'from': from_addr, 'to': to_addr},
        'networkFeatures': network_features,
        'fraudPatterns': fraud_patterns,
        'graphRisk': round(risk, 3),
        'graphStats': {
            'totalNodes': G.number_of_nodes(),
            'totalEdges': G.number_of_edges()
        }
    }


def add_edge(from_addr, to_addr, amount, timestamp, tx_type):
    if not G.has_node(from_addr):
        G.add_node(from_addr, node_type='address', first_seen=timestamp)
    if not G.has_node(to_addr):
        G.add_node(to_addr, node_type='address', first_seen=timestamp)

    if G.has_edge(from_addr, to_addr):
        G[from_addr][to_addr]['count'] = G[from_addr][to_addr].get('count', 0) + 1
        G[from_addr][to_addr]['total_amount'] = G[from_addr][to_addr].get('total_amount', 0) + amount
    else:
        G.add_edge(
            from_addr,
            to_addr,
            amount=amount,
            timestamp=timestamp,
            transaction_type=tx_type,
            count=1,
            total_amount=amount
        )

    transaction_history.append({
        'from': from_addr,
        'to': to_addr,
        'amount': amount,
        'timestamp': timestamp,
        'type': tx_type
    })


def calculate_network_features(from_addr, to_addr):
    """Calculate network metrics for addresses"""
    try:
        # Convert to undirected for some metrics
        G_undirected = G.to_undirected()

        features = {
            'degree': G.degree(from_addr) if from_addr in G else 0,
            'inDegree': G.in_degree(from_addr) if from_addr in G else 0,
            'outDegree': G.out_degree(from_addr) if from_addr in G else 0,
            'clusteringCoefficient': 0,
            'betweennessCentrality': 0
        }

        # Clustering coefficient (requires undirected graph)
        if from_addr in G_undirected and G_undirected.degree(from_addr) > 1:
            try:
                features['clusteringCoefficient'] = nx.clustering(G_undirected, from_addr)
            except Exception:
                features['clusteringCoefficient'] = 0

        # Betweenness centrality (can be expensive for large graphs)
        if G.number_of_nodes() < 1000:  # Only calculate for smaller graphs
            try:
                centrality = nx.betweenness_centrality(G)
                features['betweennessCentrality'] = centrality.get(from_addr, 0)
            except Exception:
                features['betweennessCentrality'] = 0

        return features

    except Exception as e:
        print(f"Error calculating network features: {e}")
        return {
            'degree': 0,
            'inDegree': 0,
            'outDegree': 0,
            'clusteringCoefficient': 0,
            'betweennessCentrality': 0
        }

def detect_fraud_patterns(from_addr, to_addr, amount, tx_type, timestamp):
    """
    Detect fraud patterns and return (patterns, risk_score[0-1])
    """
    patterns = []
    risk = 0.0

    try:
        in_degree = G.in_degree(to_addr)
        if in_degree > 10:
            total_incoming = sum([G[src][to_addr].get('total_amount', 0)
                                 for src in G.predecessors(to_addr)])
            risk += 0.15
            patterns.append({
                'type': 'Fund Convergence',
                'severity': 'HIGH' if in_degree > 20 else 'MEDIUM',
                'description': f'Multiple sources ({in_degree}) converging to single address',
                'details': {
                    'convergence_count': in_degree,
                    'total_amount': total_incoming,
                    'pattern': 'Welfare fraud network - multiple beneficiaries linked to one wallet'
                }
            })

        if nx.has_path(G, to_addr, from_addr):
            path_length = len(nx.shortest_path(G, to_addr, from_addr))
            if path_length <= 5:
                risk += 0.2
                patterns.append({
                    'type': 'Circular Movement',
                    'severity': 'HIGH',
                    'description': 'Circular transaction pattern detected',
                    'details': {
                        'path_length': path_length,
                        'pattern': 'Public funds moving in circular pattern'
                    }
                })

        out_degree = G.out_degree(from_addr)
        in_degree_from = G.in_degree(from_addr)
        if out_degree > 20 and in_degree_from < 3:
            risk += 0.2
            patterns.append({
                'type': 'Shell Wallet',
                'severity': 'HIGH',
                'description': 'Potential shell wallet behavior',
                'details': {
                    'out_degree': out_degree,
                    'in_degree': in_degree_from,
                    'pattern': 'High outbound transactions with minimal inbound - potential fund diversion'
                }
            })

        if from_addr in G and to_addr in G:
            from_neighbors = set(G.successors(from_addr)) | set(G.predecessors(from_addr))
            to_neighbors = set(G.successors(to_addr)) | set(G.predecessors(to_addr))
            common_neighbors = from_neighbors & to_neighbors

            if len(common_neighbors) > 5:
                risk += 0.1
                patterns.append({
                    'type': 'Collusion',
                    'severity': 'MEDIUM',
                    'description': 'Potential collusion network detected',
                    'details': {
                        'common_connections': len(common_neighbors),
                        'pattern': 'Procurement collusion - multiple addresses sharing connections'
                    }
                })

        recent_transactions = [
            t for t in transaction_history[-100:]
            if t['from'] == from_addr
        ]

        if len(recent_transactions) > 5:
            first_time = datetime.fromisoformat(recent_transactions[0]['timestamp'].replace('Z', '+00:00'))
            last_time = datetime.fromisoformat(recent_transactions[-1]['timestamp'].replace('Z', '+00:00'))
            time_diff = (last_time - first_time).total_seconds()

            if time_diff < 3600:
                risk += 0.15
                patterns.append({
                    'type': 'Rapid Sequential Transactions',
                    'severity': 'HIGH',
                    'description': 'Repeated aid claims in short time window',
                    'details': {
                        'transaction_count': len(recent_transactions),
                        'time_window_seconds': time_diff,
                        'pattern': 'Abnormal transaction frequency - potential welfare fraud'
                    }
                })

    except Exception as e:
        print(f"Error detecting fraud patterns: {e}")

    return patterns, min(risk, 1.0)


def propagate_risk(risk_map, decay_direct=0.5, decay_second=0.25):
    """Propagate risk scores outward to neighbors with decay"""
    try:
        for node, risk in list(risk_map.items()):
            if risk <= 0:
                continue
            # direct neighbors
            for nbr in G.successors(node):
                risk_map[nbr] = max(risk_map[nbr], risk * decay_direct)
            for nbr in G.predecessors(node):
                risk_map[nbr] = max(risk_map[nbr], risk * decay_direct)
            # second-level
            for nbr in list(G.successors(node)) + list(G.predecessors(node)):
                for nbr2 in list(G.successors(nbr)) + list(G.predecessors(nbr)):
                    risk_map[nbr2] = max(risk_map[nbr2], risk * decay_second)
    except Exception as e:
        print(f"Risk propagation error: {e}")

@app.route('/network/stats', methods=['GET'])
def network_stats():
    """Get overall network statistics"""
    try:
        stats = {
            'nodes': G.number_of_nodes(),
            'edges': G.number_of_edges(),
            'density': nx.density(G),
            'is_connected': nx.is_weakly_connected(G) if G.number_of_nodes() > 0 else False
        }
        
        # Calculate some basic metrics
        if G.number_of_nodes() > 0:
            degrees = dict(G.degree())
            stats['avg_degree'] = sum(degrees.values()) / len(degrees)
            stats['max_degree'] = max(degrees.values()) if degrees else 0
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/network/path', methods=['POST'])
def find_path():
    """Find path between two addresses"""
    try:
        data = request.json
        from_addr = data.get('fromAddress')
        to_addr = data.get('toAddress')
        
        if not from_addr or not to_addr:
            return jsonify({'error': 'Missing addresses'}), 400
        
        if nx.has_path(G, from_addr, to_addr):
            path = nx.shortest_path(G, from_addr, to_addr)
            return jsonify({
                'path_exists': True,
                'path': path,
                'path_length': len(path) - 1
            })
        else:
            return jsonify({
                'path_exists': False,
                'path': [],
                'path_length': 0
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting ChainShield Graph Analytics Service...")
    print("NetworkX version:", nx.__version__)
    app.run(host='0.0.0.0', port=5002, debug=True)
