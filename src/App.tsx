import { useState } from 'react';

import JSON5 from 'json5';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
} from 'react-flow-renderer';  // Remove `addEdge`



import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const levelColors = [
  '#ff9999', // Level 0
  '#99ccff', // Level 1
  '#99ff99', // Level 2
  '#ffcc99', // Level 3
  '#ccccff', // Level 4
];

export default function MindMap(): JSX.Element {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [query, setQuery] = useState<string>('');
  const [depth, setDepth] = useState<number>(3);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [tree, setTree] = useState<{ name: string; subNodes: any[] } | null>(null);

  const convertTreeToFlow = (
    tree: { name: string; subNodes: any[] },
    expandedNodes: Set<string>,
    x = 0,
    y = 0,
    parentId: string | null = null,
    level = 0,
    horizontalSpacing = 300,
    verticalSpacing = 200
  ): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const addNode = (node: { name: string; subNodes: any[] }, id: string, parentId: string | null, x: number, y: number, level: number) => {
      nodes.push({
        id,
        data: { label: node.name },
        style: {
          backgroundColor: levelColors[level % levelColors.length],
          color: '#333',
          border: '1px solid #999',
          borderRadius: '12px',
          padding: '15px',
          cursor: 'pointer',
          fontFamily: 'Cursive',
        },
        position: { x, y },
      });

      if (parentId) {
        edges.push({
          id: `${parentId}-${id}`,
          source: parentId,
          target: id,
        });
      }

      if (expandedNodes.has(id) && node.subNodes) {
        const totalWidth = (node.subNodes.length - 1) * horizontalSpacing;
        let currentX = x - totalWidth / 2;

        node.subNodes.forEach((child, index) => {
          const childId = `${id}-${index}`;
          addNode(child, childId, id, currentX, y + verticalSpacing, level + 1);
          currentX += horizontalSpacing;
        });
      }
    };

    if (tree) {
      addNode(tree, 'root', parentId, x, y, level);
    }

    return { nodes, edges };
  };

  const handleGenerate = async () => {
    const prompt = `Create a detailed JSON representation of a mind map illustrating the ${query}. The structure should follow this format:
    {
      "centralNode": "Main Topic",
      "nodes": [
        {
          "name": "Subtopic 1",
          "subNodes": [
            {
              "name": "Sub-subtopic 1.1",
              "subNodes": []
            },
            {
              "name": "Sub-subtopic 1.2",
              "subNodes": []
            }
          ]
        },
        {
          "name": "Subtopic 2",
          "subNodes": []
        }
      ]
    }
    The mind map should have up to ${depth} levels of depth.`;

    try {
      const result = await model.generateContent(prompt);
      const rawResponse = await result.response.text();

      const cleanedJsonResponse = rawResponse
        .replace(/^```json\n?/, '')
        .replace(/```/g, '')
        .replace(/\n+/g, '')
        .trim();

      let parsedResponse;
      try {
        parsedResponse = JSON5.parse(cleanedJsonResponse);
      } catch (parseError: unknown) {
        if (parseError instanceof Error) {
          throw new Error(`Failed to parse JSON: ${parseError.message}`);
        }
        throw new Error('Failed to parse JSON: Unknown error');
      }
      

      if (
        !parsedResponse ||
        typeof parsedResponse !== 'object' ||
        typeof parsedResponse.centralNode !== 'string' ||
        !Array.isArray(parsedResponse.nodes)
      ) {
        console.error('Invalid response structure:', parsedResponse);
        throw new Error('Invalid response structure. Ensure the model response matches the expected format.');
      }

      const tree = {
        name: parsedResponse.centralNode,
        subNodes: parsedResponse.nodes.map((node: { name: string; subNodes: any[] }) => ({
          name: node.name,
          subNodes: node.subNodes || [],
        })),
      };

      setTree(tree);
      const { nodes: generatedNodes, edges: generatedEdges } = convertTreeToFlow(tree, expandedNodes);
      setNodes(generatedNodes);
      setEdges(generatedEdges);
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Failed to generate the mind map: ${error.message}`);
      } else {
        alert('An unknown error occurred.');
      }
    }
    
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const updated = new Set(prev);
      if (updated.has(nodeId)) {
        updated.delete(nodeId);
      } else {
        updated.add(nodeId);
      }

      if (tree) {
        const { nodes: updatedNodes, edges: updatedEdges } = convertTreeToFlow(tree, updated);
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      }

      return updated;
    });
  };

  const handleNodeClick = (_: any, node: Node) => {
    toggleNode(node.id);
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#121212',
        color: '#fff',
      }}
    >
      <h1 style={{ textAlign: 'center', fontFamily: 'Cursive', color: '#ff9800' }}>MindMaven</h1>
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          Query:{' '}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter the topic (e.g., lifecycle of a star)"
            style={{
              padding: '10px',
              width: '300px',
              borderRadius: '12px',
              border: '1px solid #555',
              backgroundColor: '#1e1e1e',
              color: '#fff',
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          Depth:{' '}
          <input
            type="number"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            min="1"
            max="10"
            style={{
              padding: '10px',
              width: '100px',
              borderRadius: '12px',
              border: '1px solid #555',
              backgroundColor: '#1e1e1e',
              color: '#fff',
            }}
          />
        </label>
      </div>
      <button
        onClick={handleGenerate}
        style={{
          backgroundColor: '#ff5722',
          color: '#fff',
          padding: '15px 30px',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          alignSelf: 'center',
          fontSize: '16px',
        }}
      >
        Generate Mind Map
      </button>
      <div style={{ flex: 1, marginTop: '20px', background: '#1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
          onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
          onNodeClick={handleNodeClick}
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
