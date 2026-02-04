import { useCallback, useMemo, useEffect, type ReactElement } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    Edge,
    Position,
    Handle,
    Background,
    Controls,
    Node,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { ChevronDown, ChevronRight, Folder, FileText } from 'lucide-react';

// --- Types ---
type FileNodeData = {
    label: string;
    type: 'folder' | 'file';
    expanded?: boolean;
    onToggle?: (id: string) => void;
};

// --- Layout Logic (Dagre) ---
const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[],
    direction = 'LR'
): { nodes: Node[]; edges: Edge[] } => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        if (!node.hidden) {
            dagreGraph.setNode(node.id, { width: 180, height: 50 });
        }
    });

    edges.forEach((edge) => {
        // Only layout visible edges
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (sourceNode && !sourceNode.hidden && targetNode && !targetNode.hidden) {
            dagreGraph.setEdge(edge.source, edge.target);
        }
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        if (node.hidden) return node;
        const nodeWithPosition = dagreGraph.node(node.id);

        // Safety check if dagre missed a node
        if (!nodeWithPosition) return node;

        return {
            ...node,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            position: {
                x: nodeWithPosition.x - 90,
                y: nodeWithPosition.y - 25,
            },
        };
    });

    return { nodes: newNodes, edges };
};

// --- Custom Node Component ---
const CollapsibleNode = ({ id, data }: { id: string, data: FileNodeData }): ReactElement => {
    return (
        <div className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm bg-white dark:bg-zinc-900 min-w-[160px] cursor-pointer hover:shadow-md transition-all
            ${data.type === 'folder' ? 'border-sky-500/50' : 'border-zinc-200 dark:border-zinc-800'}
        `}
            onClick={() => {
                if (data.type === 'folder' && data.onToggle) {
                    data.onToggle(id);
                }
            }}
        >
            <Handle type="target" position={Position.Left} className="!bg-sky-500 !w-1.5 !h-1.5" />

            {data.type === 'folder' && (
                <div className="p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    {data.expanded ? <ChevronDown className="w-4 h-4 text-sky-600" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                </div>
            )}

            {data.type === 'folder' ? <Folder className="w-4 h-4 text-sky-500" /> : <FileText className="w-3.5 h-3.5 text-zinc-400" />}

            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate max-w-[100px] select-none">
                {data.label}
            </span>

            <Handle type="source" position={Position.Right} className="!bg-sky-500 !w-1.5 !h-1.5" />
        </div>
    );
};

const nodeTypes = {
    custom: CollapsibleNode,
};

// --- Graph Builder Logic ---
// Revised to be simpler: Just build the flat list, we manage visibility in the View
const buildGraphFromPaths = (
    paths: string[],
    rootLabel: string = 'Project Root',
    autoExpandAll: boolean = false
): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const createdNodes = new Set<string>();

    const rootId = 'root';
    nodes.push({
        id: rootId,
        type: 'custom',
        data: { label: rootLabel, type: 'folder', expanded: true },
        position: { x: 0, y: 0 }
    });
    createdNodes.add(rootId);

    paths.forEach(path => {
        const parts = path.split('/');
        let parentId = rootId;

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1 && part.includes('.');
            const id = parts.slice(0, index + 1).join('/');

            if (!createdNodes.has(id)) {
                nodes.push({
                    id,
                    type: 'custom',
                    data: {
                        label: part,
                        type: isFile ? 'file' : 'folder',
                        expanded: autoExpandAll && !isFile
                    },
                    hidden: autoExpandAll ? false : index > 0,
                    position: { x: 0, y: 0 }
                });

                edges.push({
                    id: `${parentId}-${id}`,
                    source: parentId,
                    target: id,
                    type: 'smoothstep',
                    animated: false,
                    style: { stroke: isFile ? 'var(--edge-muted)' : 'var(--accent-500)', strokeWidth: 1.5 },
                });

                createdNodes.add(id);
            }
            parentId = id;
        });
    });

    return { nodes, edges };
};

// --- Inner Component that uses ReactFlow Store ---
const DiagramContent = ({
    filePaths,
    rootName,
    autoExpandAll,
}: {
    filePaths?: string[];
    rootName?: string;
    autoExpandAll?: boolean;
}): ReactElement => {
    const { fitView } = useReactFlow();

    // Demo Paths if none provided
    const paths = useMemo(() => (filePaths && filePaths.length > 0) ? filePaths : [
        "src/main.rs",
        "src/lib.rs",
        "src/components/Header.tsx",
        "src-tauri/src/main.rs",
    ], [filePaths]);

    const shouldExpandAll = autoExpandAll ?? paths.length <= 300;

    // Initialize Graph
    const { initialNodes, initialEdges } = useMemo(() => {
        const { nodes, edges } = buildGraphFromPaths(paths, rootName || "Project Root", shouldExpandAll);
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'LR');
        // Root should be expanded by default so we can see children
        const root = layoutedNodes.find(n => n.id === 'root');
        if (root) root.data.expanded = true;

        return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
    }, [paths, rootName, shouldExpandAll]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
        window.requestAnimationFrame(() => {
            fitView({ duration: 600, padding: 0.2 });
        });
    }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

    // Re-layout when hidden states change? No, we handle that in toggle

    const onNodeClick = useCallback(() => {
        // This is a backup click handler, usually the node handles it via data.onToggle
    }, []);

    // The Recursive Toggle Function
    const handleToggle = useCallback((nodeId: string) => {
        setNodes((nds) => {
            const node = nds.find(n => n.id === nodeId);
            if (!node || node.data.type === 'file') return nds;

            const isExpanded = !!node.data.expanded;
            const nextExpanded = !isExpanded;

            // 1. Update clicked node state
            const updatedNodes = nds.map(n => {
                if (n.id === nodeId) {
                    return { ...n, data: { ...n.data, expanded: nextExpanded } };
                }
                return n;
            });

            // 2. Find children and toggle visibility
            // We need to know who the children are. Since we don't have an adjacency list in state,
            // we rely on the ID convention (parent/child/grandchild) or edges.
            // ID convention is safest here: `parent/child` starts with `parent/`
            // BUT strict prefix might fail if similar names.
            // Let's use the ID substring check for this implementation as ids are full paths.
            // "src" is parent of "src/main.rs". "src/components" is parent of "src/components/Header.tsx"

            const targetPrefix = nodeId === 'root' ? '' : `${nodeId}/`;

            return updatedNodes.map(n => {
                // If it's the root's child, prefix check is tricky.
                // Doing a robust Edge check would be better but expensive in reducer.
                // Let's stick to Path Prefix logic since we built IDs that way.

                if (n.id === 'root') return n; // Root never hidden
                if (n.id === nodeId) return n; // Already handled

                // Check if direct child?
                // Direct child of "src" is "src/main.rs" (no extra slashes)
                // "src/components/Header.tsx" is NOT direct child of "src".

                const relativePath = nodeId === 'root' ? n.id : n.id.replace(`${targetPrefix}`, '');
                const isDirectChild = nodeId === 'root'
                    ? !n.id.includes('/')
                    : n.id.startsWith(targetPrefix) && !relativePath.includes('/');

                if (isDirectChild) {
                    // If Opening: Show direct children
                    if (nextExpanded) {
                        return { ...n, hidden: false };
                    } else {
                        // If Closing: Hide direct children AND ALL DECENDANTS
                        return { ...n, hidden: true, data: { ...n.data, expanded: false } }; // Collapse children too? Yes.
                    }
                }

                // If we are closing, we must hide EVERYTHING deeper too
                if (!nextExpanded && n.id.startsWith(targetPrefix)) {
                    return { ...n, hidden: true, data: { ...n.data, expanded: false } };
                }

                return n;
            });
        });

        // Trigger Layout Recalculation after state update
        // We need a useEffect or similar, but simplified: call getLayoutedElements immediately inside setNodes?
        // Actually, we should trigger a layout effect.
    }, [setNodes]);

    // Effect to run layout whenever visibility changes
    // But we need to avoid loops.
    // Let's wrap setNodes to include layout.
    const onToggleWrapper = useCallback((nodeId: string) => {
        handleToggle(nodeId);
        // Force re-layout and fit view after a short delay to allow render
        setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitView({ duration: 800, padding: 0.2 });
            });
        }, 50);
    }, [handleToggle, fitView]);

    // Apply Toggle Handler to Node Data
    useEffect(() => {
        setNodes((nds) => nds.map((node) => ({
            ...node,
            data: {
                ...node.data,
                onToggle: onToggleWrapper,
            },
        })));
    }, [onToggleWrapper, setNodes]);


    // Layout Calculation happens on every render via getLayoutedElements inside ReactFlow props.
    // This ensures that when 'hidden' state changes (triggering re-render), the layout is recalculated for visible nodes.

    // Better strategy: Calculate layout IN handleToggle or use a separate layout trigger.
    // For now, let's do it simply:
    // The getLayoutedElements is pure. We can call it inside render? No.

    // Let's use a layout trigger state.

    return (
        <ReactFlow
            nodes={getLayoutedElements(nodes, edges, 'LR').nodes} // Calculate layout on render (fast enough for <500 nodes)
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-zinc-50 dark:bg-black"
        >
            <Background gap={12} size={1} />
            <Controls />
        </ReactFlow>
    );
};

// --- Main Export ---
export default function DiagramView({
    filePaths,
    rootName,
    autoExpandAll,
}: {
    filePaths?: string[];
    rootName?: string;
    autoExpandAll?: boolean;
}): ReactElement {
    return (
        <div className="w-full h-full bg-background transition-colors duration-300">
            <ReactFlowProvider>
                <DiagramContent filePaths={filePaths} rootName={rootName} autoExpandAll={autoExpandAll} />
            </ReactFlowProvider>
        </div>
    );
}
