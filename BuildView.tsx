import React, { useEffect, useState, useCallback } from 'react';
import { Zap, CheckCircle, ArrowRight, Database, Upload, X, Brain, Paperclip, Plus } from 'lucide-react';
import { HashLoader } from 'react-spinners';
import ReactFlow, { 
  Node, 
  Controls, 
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  EdgeTypes,
  BaseEdge,
  getBezierPath
} from 'reactflow';
import 'reactflow/dist/style.css';
import { llmService } from '../services/llmService';
import { conversationMemoryService } from '../services/conversationMemoryService';
import { KnowledgeBaseModal } from './KnowledgeBaseModal';
import { FileUploadModal } from './FileUploadModal';

interface AgentConfiguration {
  agent_name: string;
  llm_model: string;
  system_prompt: string;
  tools_to_activate: string[];
  prerequisites: {
    oauth?: string[];
    files?: string[];
    database_credentials?: boolean;
    pinecone_index_name?: string;
  };
}

interface BuildViewProps {
  userPrompt: string;
  isBuilding: boolean;
  buildProgress: number;
  isAgentReady: boolean;
  onProgressUpdate: (progress: number) => void;
  onBuildComplete: () => void;
  onOpenChat: () => void;
  templateMatch?: any | null;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface BuildSession {
  build_id: string;
  state: string;
  original_prompt: string;
  db_connection_string?: string;
  uploaded_file_paths?: string[];
  agent_config: any;
  history: any[];
  ui_request?: {
    type: string;
    data?: any;
  };
}

// Custom Node Component
const CustomNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-1 min-w-[60px] max-w-[60px]">
      <div className="flex flex-col items-center">
        {data.isLoading ? (
          <div className="w-6 h-6 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
            <HashLoader size={12} color="#6B7280" />
          </div>
        ) : (
          <div className="w-6 h-6 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            {data.type === 'memory' ? (
              <Brain className="w-4 h-4 text-purple-500" />
            ) : data.type === 'openai' ? (
              <img src={data.icon} alt={data.label} className="w-4 h-3" />
            ) : (
              <img src={data.icon} alt={data.label} className="w-4 h-4" />
            )}
          </div>
        )}
        <p className="text-[10px] text-gray-600 mt-1 font-medium text-center leading-tight">{data.label}</p>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// Custom Edge Component
const CustomEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: any) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
    </>
  );
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

export function BuildView({
  userPrompt,
  isBuilding,
  buildProgress,
  isAgentReady,
  onProgressUpdate,
  onBuildComplete,
  onOpenChat,
  templateMatch
}: BuildViewProps) {
  const [buildSession, setBuildSession] = useState<BuildSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showThinking, setShowThinking] = useState(true);
  const [showProjectPlan, setShowProjectPlan] = useState(false);
  const [projectApproved, setProjectApproved] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionConfig, setConnectionConfig] = useState({
    hostname: '',
    username: '',
    password: '',
    database: '',
    port: '5432'
  });
  const [showDatabaseChat, setShowDatabaseChat] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [currentTypingIndex, setCurrentTypingIndex] = useState(0);
  const [projectPlanText, setProjectPlanText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [waitingForClarification, setWaitingForClarification] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [agentConfig, setAgentConfig] = useState<AgentConfiguration | null>(null);
  const [savedAgentId, setSavedAgentId] = useState<number | null>(null);
  const [missingPrerequisites, setMissingPrerequisites] = useState<string[]>([]);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false);
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);

  // Database chat state
  const [databaseMessages, setDatabaseMessages] = useState<ChatMessage[]>([]);
  const [databaseInput, setDatabaseInput] = useState('');
  const [isDatabaseThinking, setIsDatabaseThinking] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<'thinking' | 'extracting' | 'consolidating' | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Debug edges
  useEffect(() => {
    console.log('Current edges:', edges);
  }, [edges]);

  const buildSteps = [
    'Finalizing architecture...',
    'Setting up integrations...',
    'Generating agent logic...',
    'Configuring workflows...',
    'Finalizing deployment...'
  ];

  // Generate dynamic agent success message based on analysis
  const generateAgentSuccessMessage = () => {
    if (!agentConfig) return "Your AI agent is ready! You can now test and deploy it.";
    
    const connections = agentConfig.prerequisites?.oauth || [];
    
    // Determine agent type based on connections and template
    let agentType = "AI";
    let capabilities = [];
    
    if (connections.includes('gmail') || connections.includes('google')) {
      agentType = "Email Management";
      capabilities = ["Gmail integration", "email automation"];
    } else if (connections.includes('slack')) {
      agentType = "Communication";
      capabilities = ["Slack integration", "team collaboration"];
    } else if (connections.includes('jira')) {
      agentType = "Project Management";
      capabilities = ["Jira integration", "issue tracking"];
    } else if (agentConfig.tools_to_activate && agentConfig.tools_to_activate.includes('supabase_query')) {
      agentType = "Database";
      capabilities = ["database queries", "data analysis"];
    } else {
      agentType = "General Purpose AI";
      capabilities = connections.length > 0 ? connections : ["intelligent conversation"];
    }
    
    const capabilityText = capabilities.length > 0 
      ? ` with ${capabilities.join(", ")} capabilities` 
      : "";
    
    return `Your ${agentType} agent is ready! You can now test it${capabilityText} and start leveraging its features.`;
  };

  // Phase 2: Start a new build session when the component mounts with a prompt
  useEffect(() => {
    if (!userPrompt || buildSession) return; // Only run once when prompt is available

    const startBuild = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/builds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userPrompt }),
        });
        if (!response.ok) throw new Error("Failed to start build session");
        
        const session: BuildSession = await response.json();
        setBuildSession(session);
      } catch (error) {
        console.error("Error starting build session:", error);
        // Handle error state in UI
      }
    };

    startBuild();
  }, [userPrompt]);

  useEffect(() => {
    if (userPrompt) {
      setChatMessages([
        {
          id: `user-${Date.now()}`,
          type: 'user',
          content: userPrompt,
          timestamp: new Date(),
        },
      ]);
    }
  }, [userPrompt]);

  // Phase 2: React to state changes from the build session
  useEffect(() => {
    if (!buildSession) return;

    // Get the latest thought from the architect
    const lastMessage = buildSession.history[buildSession.history.length - 1]?.message_to_user;

    // Update chat messages with the architect's thoughts
    if (lastMessage) {
      setChatMessages(prev => {
        // Avoid adding duplicate messages
        if (prev[prev.length - 1]?.content !== lastMessage) {
          return [...prev, {
            id: `agent-${Date.now()}`,
            type: 'agent',
            content: lastMessage,
            timestamp: new Date()
          }];
        }
        return prev;
      });
    }

    // Handle UI requests from the architect
    if (buildSession.ui_request) {
      switch (buildSession.ui_request.type) {
        case 'REQUEST_DB_CREDENTIALS':
          setShowConnectionModal(true);
          break;
        // Add other UI request handlers here
      }
    }

    // Handle the state from the architect
    switch (buildSession.state) {
      case 'WAITING_FOR_USER_INPUT':
        setShowThinking(false);
        // Allow user to type
        break;
      case 'CONFIGURATION_PROPOSED':
        setShowThinking(false);
        // Display proposed config and wait for approval/feedback
        break;
      case 'CONFIGURATION_FINALIZED':
        setShowThinking(false);
        setAgentConfig(buildSession.agent_config);
        setShowArchitecture(true);
        // The agent is now configured, and we can save it.
        saveAgentConfig(buildSession.agent_config);
        onProgressUpdate(0);
        break;
      case 'FAILED':
        setShowThinking(false);
        // Show an error message
        break;
      case 'REQUEST_DB_CREDENTIALS':
        setShowConnectionModal(true);
        break;
      case 'COMPLETED':
        // The agent is built, we can proceed to the build animation
        setShowConnectionModal(false);
        setAgentConfig(buildSession.agent_config);
        setSavedAgentId(buildSession.agent_config.id); // Assuming the final config has an ID
        setShowArchitecture(true);
        onProgressUpdate(0);
        break;
      case 'DB_CONNECTION_FAILED':
        // Show an error in the modal (a real implementation would have better UI)
        alert("Database connection failed. Please check your credentials and try again.");
        setShowConnectionModal(true); // Keep the modal open
        break;
      // TODO: Add cases for REQUEST_CSV_FILE etc.
    }

  }, [buildSession]);

  // Test n8n connection on mount
  /*
  useEffect(() => {
    const testN8nConnection = async () => {
      try {
        setN8nConnectionStatus('checking');
        const isConnected = await n8nIntegrationService.testConnection();
        const instanceInfo = await n8nIntegrationService.getInstanceInfo();
        
        setN8nConnectionStatus(isConnected ? 'connected' : 'disconnected');
        setN8nInstanceInfo(instanceInfo);
      } catch (error) {
        console.error('Failed to test n8n connection:', error);
        setN8nConnectionStatus('disconnected');
      }
    };

    testN8nConnection();
  }, []);
  */

  // Perform LLM analysis
  const performLLMAnalysis = async () => {
    try {
      console.log('Performing LLM analysis...');
      const result = await workflowAnalysisService.analyzeUserPrompt(userPrompt);
      
      console.log('LLM analysis completed:', result);
      setAnalysisResult(result);
      setProjectPlanText(result.projectPlan);
      setLogs(result.logs);
      
      // Store analysis in memory
      conversationMemoryService.storeAnalysisResult({
        prompt: userPrompt,
        analysis: result.analysis,
        requirements: result.analysis.requirements,
        strategy: result.analysis.requirements.strategy || '',
        clarifications: result.analysis.requirements.clarifications || [],
        userResponses: {},
        timestamp: new Date()
      });
      
      // Check if LLM needs clarification
      if (result.analysis.needsClarification && result.analysis.suggestedQuestions) {
        setClarificationQuestions(result.analysis.suggestedQuestions);
        setWaitingForClarification(true);
        return;
      }
      
      // Show project plan immediately
      setShowThinking(false);
      setShowProjectPlan(true);
      setTypingText('');
      setCurrentTypingIndex(0);
      
    } catch (error) {
      console.error('LLM analysis failed:', error);
      // Fail-safe to stop indefinite thinking
      setShowThinking(false);
    }
  };

  // Typing effect for project plan
  useEffect(() => {
    if (showProjectPlan && currentTypingIndex < projectPlanText.length) {
      const timer = setTimeout(() => {
        setTypingText(projectPlanText.slice(0, currentTypingIndex + 1));
        setCurrentTypingIndex(currentTypingIndex + 1);
      }, 1); // Ultra fast typing animation

      return () => clearTimeout(timer);
    }
  }, [showProjectPlan, currentTypingIndex, projectPlanText]);

  // Add project plan message when typing is complete
  useEffect(() => {
    if (showProjectPlan && currentTypingIndex === projectPlanText.length) {
      setChatMessages(prev => {
        const exists = prev.some(msg => msg.content.includes('I\'ll help you build'));
        if (!exists) {
          return [...prev, {
            id: `plan-${Date.now()}`,
            type: 'agent',
            content: projectPlanText,
            timestamp: new Date()
          }];
        }
        return prev;
      });
    }
  }, [showProjectPlan, currentTypingIndex, projectPlanText]);

  const canApprove = showProjectPlan && currentTypingIndex === projectPlanText.length;

  // Handle project approval and start architecture
  const handleProjectApproval = async () => {
    if (!canApprove) return;
    setProjectApproved(true);
    setShowProjectPlan(false);
    setShowArchitecture(true);
    
    // Add approval message
    setChatMessages(prev => [...prev, {
      id: `approve-${Date.now()}`,
      type: 'user',
      content: 'Yes, please proceed with the build!',
      timestamp: new Date()
    }]);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/agents/architect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userPrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to get agent configuration from architect');
      }

      const config: AgentConfiguration = await response.json();
      setAgentConfig(config);
      console.log("Received agent config:", config);

      // NEW LOGIC: Check for database credentials prerequisite
      if (config.prerequisites.database_credentials) {
        console.log("Agent requires database credentials. Showing connection modal.");
        setShowConnectionModal(true);
        // We stop here and wait for the user to submit credentials.
        // The rest of the agent creation process will be handled by the modal's submit function.
        return;
      }

      // Save the agent configuration to the database
      try {
        const agentData = {
          user_email: "fahadpatel5700@gmail.com", // Replace with actual logged-in user email
          name: config.agent_name || "New Agent",
          system_prompt: config.system_prompt || "You are a helpful assistant.",
          configuration: {
            tools_to_activate: config.tools_to_activate || [],
            prerequisites: config.prerequisites || {},
            llm_model: config.llm_model || "gpt-4o",
            pinecone_index_name: config.prerequisites?.pinecone_index_name || null
          }
        };

        const saveResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentData),
        });

        if (!saveResponse.ok) {
          throw new Error('Failed to save agent configuration');
        }

        const savedAgent = await saveResponse.json();
        setSavedAgentId(savedAgent.id);
        console.log("Agent saved with ID:", savedAgent.id);

        // Transition to build animation
        setShowArchitecture(true);
        onProgressUpdate(0); // This will trigger the building state
      } catch(error) {
        console.error("Error saving agent:", error);
        // Handle UI error state
        return;
      }

      // Start architecture animation sequence based on analysis result immediately
      if (templateMatch && templateMatch.template) {
        // Use template-based architecture
        // generateTemplateBasedArchitecture(templateMatch.template);
      } else {
        // Use generic connection-based architecture
        generateGenericArchitecture(config.prerequisites.oauth || []);
      }
    } catch (error) {
      console.error("Error fetching agent configuration:", error);
      // Handle error state in UI
    }

    // Animate nodes loading and connecting immediately
    setNodes(prev => prev.map(node => ({ ...node, data: { ...node.data, isLoading: false } })));

    // Add connections immediately
    const newEdges: any[] = [];
    const nodeIds = nodes.map(n => n.id);
    
    // Connect all nodes to OpenAI
    nodeIds.forEach(nodeId => {
      if (nodeId !== 'openai') {
        newEdges.push({
          id: `${nodeId}-openai`,
          source: nodeId,
          target: 'openai',
          type: 'custom',
          style: { stroke: '#6B7280', strokeWidth: 3 }
        });
      }
    });

    // Connect all nodes to memory
    nodeIds.forEach(nodeId => {
      if (nodeId !== 'memory') {
        newEdges.push({
          id: `${nodeId}-memory`,
          source: nodeId,
          target: 'memory',
          type: 'custom',
          style: { stroke: '#6B7280', strokeWidth: 3 }
        });
      }
    });

    setEdges(newEdges);

    // Start building immediately after architecture is complete
    // onProgressUpdate(0); // This is now handled after saving the agent
  };

  // Building progress effect
  useEffect(() => {
    if (isBuilding) {
      const interval = setInterval(() => {
        const newProgress = buildProgress + (100 / buildSteps.length / 10);
        if (newProgress >= 100) {
          clearInterval(interval);
          onBuildComplete();
          onProgressUpdate(100);
        } else {
          onProgressUpdate(newProgress);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isBuilding, buildProgress, onProgressUpdate, onBuildComplete, buildSteps.length]);

  // Add completion message
  useEffect(() => {
    if (isAgentReady) {
      console.log('Agent is ready, current messages:', chatMessages);
      setChatMessages(prev => {
        const exists = prev.some(msg => msg.content.includes('Agent built successfully'));
        console.log('Checking if completion message exists:', exists);
        if (!exists) {
          const newMessages: ChatMessage[] = [...prev, {
            id: Date.now().toString(),
            type: 'agent' as const,
            content: generateAgentSuccessMessage(),
            timestamp: new Date()
          }];
          console.log('Adding completion message, new messages:', newMessages);
          return newMessages;
        }
        return prev;
      });
    }
  }, [isAgentReady, agentConfig]);

  const currentStepIndex = Math.floor((buildProgress / 100) * buildSteps.length);

  // Handle clarification responses
  // const handleClarificationResponse = async (responses: { [question: string]: string }) => {
  //   setWaitingForClarification(false);
    
  //   // Re-analyze with user responses
  //   const updatedPrompt = `${userPrompt}\n\nUser clarifications:\n${Object.entries(responses).map(([q, a]) => `${q}: ${a}`).join('\n')}`;
    
  //   try {
  //     const result = await workflowAnalysisService.analyzeUserPrompt(updatedPrompt);
  //     setAnalysisResult(result);
  //     setProjectPlanText(result.projectPlan);
  //     setLogs([...logs, ...result.logs]);
      
  //     // Show project plan immediately
  //     setShowThinking(false);
  //     setShowProjectPlan(true);
  //     setTypingText('');
  //     setCurrentTypingIndex(0);
  //   } catch (error) {
  //     console.error('Re-analysis failed:', error);
  //   }
  // };

  // Handle chat message submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && buildSession) {
      const userMessageContent = newMessage.trim();
      const userMessage = {
        id: `user-${Date.now()}`,
        type: 'user' as const,
        content: userMessageContent,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, userMessage]);
      setNewMessage('');
      setShowThinking(true);

      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/builds/${buildSession.build_id}/continue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputs: {
              message: userMessageContent,
            }
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to continue build session");
        }

        const updatedSession: BuildSession = await response.json();
        setBuildSession(updatedSession);

      } catch (error) {
        console.error("Error continuing build session:", error);
        // Handle error in UI
      }
    }
  };

  // Handle follow-up questions
  const handleFollowUpQuestion = async (followUpMessage: string) => {
    try {
      // Get conversation context for follow-up
      // const context = conversationMemoryService.getFollowUpContext(followUpMessage);
      
      // Analyze with context
      const result = await llmService.analyzePrompt(followUpMessage, true);
      
      // Store analysis in memory
      conversationMemoryService.storeAnalysisResult({
        prompt: followUpMessage,
        analysis: result,
        requirements: result.requirements,
        strategy: result.requirements.strategy || '',
        clarifications: result.requirements.clarifications || [],
        userResponses: {},
        timestamp: new Date()
      });

      // Add agent response
      const agentMessage = {
        id: `agent-followup-${Date.now()}`,
        type: 'agent' as const,
        content: `Based on our previous conversation, here's what I understand about your follow-up request:\n\n${result.requirements.strategy || 'I\'ll help you with that.'}`,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, agentMessage]);
      
      // Store agent response in memory
      conversationMemoryService.addConversationEntry({
        type: 'agent',
        content: agentMessage.content
      });

    } catch (error) {
      console.error('Failed to handle follow-up question:', error);
    }
  };

  // Handle new requests
  const handleNewRequest = async (newRequest: string) => {
    try {
      // Clear previous analysis state
      setAnalysisResult(null);
      setProjectPlanText('');
      setShowThinking(true);
      setShowProjectPlan(false);
      
      // Perform new analysis
      const result = await workflowAnalysisService.analyzeUserPrompt(newRequest);
      setAnalysisResult(result);
      setProjectPlanText(result.projectPlan);
      setLogs(result.logs);
      
      // Store analysis in memory
      conversationMemoryService.storeAnalysisResult({
        prompt: newRequest,
        analysis: result.analysis,
        requirements: result.analysis.requirements,
        strategy: result.analysis.requirements.strategy || '',
        clarifications: result.analysis.requirements.clarifications || [],
        userResponses: {},
        timestamp: new Date()
      });

      // Show project plan immediately
      setShowThinking(false);
      setShowProjectPlan(true);
      setTypingText('');
      setCurrentTypingIndex(0);
      
    } catch (error) {
      console.error('Failed to handle new request:', error);
    }
  };

  // Handle clarification answer
  const handleClarificationAnswer = async (answer: string) => {
    const currentQuestion = clarificationQuestions[currentQuestionIndex];
    
    // Add the question and answer to chat
    setChatMessages(prev => [
      ...prev,
      {
        id: `clarification-${currentQuestionIndex}`,
        type: 'agent' as const,
        content: `To better understand your requirements, I need to know: ${currentQuestion}`,
        timestamp: new Date()
      },
      {
        id: `answer-${currentQuestionIndex}`,
        type: 'user' as const,
        content: answer,
        timestamp: new Date()
      }
    ]);

    // Store the answer
    const responses = { [currentQuestion]: answer };
    
    // Move to next question or complete
    if (currentQuestionIndex + 1 < clarificationQuestions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // All questions answered, re-analyze
      setWaitingForClarification(false);
      setCurrentQuestionIndex(0);
      
      // Re-analyze with all responses
      const allResponses = { ...responses };
      const updatedPrompt = `${userPrompt}\n\nUser clarifications:\n${Object.entries(allResponses).map(([q, a]) => `${q}: ${a}`).join('\n')}`;
      
      try {
        const result = await workflowAnalysisService.analyzeUserPrompt(updatedPrompt);
        setAnalysisResult(result);
        setProjectPlanText(result.projectPlan);
        setLogs([...logs, ...result.logs]);
        
        // Show project plan immediately
        setShowThinking(false);
        setShowProjectPlan(true);
        setTypingText('');
        setCurrentTypingIndex(0);
      } catch (error) {
        console.error('Re-analysis failed:', error);
      }
    }
  };

  // Template validation function
  /*
  const validateTemplateStructure = (template: any, fileName: string) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check basic structure
    if (!template || typeof template !== 'object') {
      errors.push('Template is not a valid object');
      return { isValid: false, errors, warnings };
    }
    
    // Check for required top-level properties
    if (!template.nodes || !Array.isArray(template.nodes)) {
      errors.push('Template missing nodes array');
    } else if (template.nodes.length === 0) {
      warnings.push('Template has no nodes');
    }
    
    if (!template.connections || typeof template.connections !== 'object') {
      errors.push('Template missing connections object');
    }
    
    // Validate nodes
    if (template.nodes && Array.isArray(template.nodes)) {
      template.nodes.forEach((node: any, index: number) => {
        if (!node.id) {
          errors.push(`Node ${index} missing id`);
        }
        if (!node.name) {
          warnings.push(`Node ${index} missing name`);
        }
        if (!node.type) {
          errors.push(`Node ${index} missing type`);
        }
        if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
          warnings.push(`Node ${index} has invalid position`);
        }
      });
    }
    
    // Check for credential nodes and their structure
    const credentialNodes = template.nodes?.filter((node: any) => 
      node.credentials && Object.keys(node.credentials).length > 0
    ) || [];
    
    if (credentialNodes.length > 0) {
      console.log(`🔍 [TEMPLATE VALIDATION] Found ${credentialNodes.length} nodes with credentials`);
      credentialNodes.forEach((node: any) => {
        const nodeCredentials = Object.keys(node.credentials);
        console.log(`🔍 [TEMPLATE VALIDATION] Node ${node.name} requires credentials:`, nodeCredentials);
      });
    }
    
    // Validate connections structure
    if (template.connections) {
      const nodeIds = new Set(template.nodes?.map((n: any) => n.name) || []);
      Object.keys(template.connections).forEach(sourceNode => {
        if (!nodeIds.has(sourceNode)) {
          warnings.push(`Connection references unknown source node: ${sourceNode}`);
        }
        
        const connections = template.connections[sourceNode];
        if (connections.main && Array.isArray(connections.main)) {
          connections.main.forEach((connGroup: any, groupIndex: number) => {
            if (Array.isArray(connGroup)) {
              connGroup.forEach((conn: any, connIndex: number) => {
                if (!conn.node || !nodeIds.has(conn.node)) {
                  warnings.push(`Connection ${sourceNode}[${groupIndex}][${connIndex}] references unknown target node: ${conn.node}`);
                }
              });
            }
          });
        }
      });
    }
    
    const isValid = errors.length === 0;
    
    return {
      isValid,
      errors,
      warnings,
      nodeCount: template.nodes?.length || 0,
      credentialNodeCount: credentialNodes.length,
      connectionCount: template.connections ? Object.keys(template.connections).length : 0
    };
  };
  */

  // Deploy workflow to n8n
  /*
  const deployWorkflow = async () => {
    if (!analysisResult) return;
    
    // Check n8n connection first
    if (n8nConnectionStatus !== 'connected') {
      setDeploymentStatus('error');
      setDeploymentMessage('n8n is not connected. Please ensure n8n is running and accessible.');
      return;
    }
    
    setDeploymentStatus('deploying');
    setDeploymentMessage('Preparing workflow deployment...');
    
    try {
      // Get OAuth tokens
      const tokens = await oauthTokenService.getValidTokensForDeployment();
      
      // Add OpenAI token from environment if needed
      if (analysisResult.requiredConnections.includes('openai')) {
        // Get OpenAI API key from environment variables (frontend first, then backend fallback)
        let openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
        
        if (!openaiKey) {
          console.log('🔍 [N8N DEPLOYMENT] OpenAI key not found in frontend env, checking backend...');
          try {
            // Try to get from backend environment
            const backendResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/config/openai-key`);
            if (backendResponse.ok) {
              const data = await backendResponse.json();
              openaiKey = data.apiKey;
              console.log('🔑 [N8N DEPLOYMENT] Retrieved OpenAI key from backend');
            }
          } catch (error) {
            console.warn('⚠️ [N8N DEPLOYMENT] Could not retrieve OpenAI key from backend:', error);
          }
        }
        
        if (openaiKey) {
          tokens['openai'] = openaiKey;
          console.log('🔑 [N8N DEPLOYMENT] Added OpenAI token from environment variables');
        } else {
          console.warn('⚠️ [N8N DEPLOYMENT] OpenAI API key not found in environment variables');
          // Don't fail deployment, just warn - the workflow can be deployed without OpenAI node working
        }
      }
      
      // Add Pinecone token from environment if needed  
      if (analysisResult.requiredConnections.includes('pinecone')) {
        console.log('🔍 [N8N DEPLOYMENT] Pinecone integration detected, checking for API key...');
        
        let pineconeKey = import.meta.env.VITE_PINECONE_API_KEY;
        
        if (!pineconeKey) {
          console.log('🔍 [N8N DEPLOYMENT] Pinecone key not found in frontend env, checking backend...');
          try {
            // Try to get from backend environment
            const backendResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/config/pinecone-key`);
            if (backendResponse.ok) {
              const data = await backendResponse.json();
              pineconeKey = data.apiKey;
              console.log('🔑 [N8N DEPLOYMENT] Retrieved Pinecone key from backend');
            }
          } catch (error) {
            console.warn('⚠️ [N8N DEPLOYMENT] Could not retrieve Pinecone key from backend:', error);
          }
        }
        
        if (pineconeKey) {
          tokens['pinecone'] = {
            apiKey: pineconeKey,
            environment: import.meta.env.VITE_PINECONE_ENVIRONMENT || 'us-east-1-aws'
          };
          console.log('🔑 [N8N DEPLOYMENT] Added Pinecone token from environment variables');
        } else {
          console.warn('⚠️ [N8N DEPLOYMENT] Pinecone API key not found in environment variables');
          // Don't fail deployment, just warn - Pinecone nodes may need manual configuration
        }
      }
      
      // Check if we have required tokens (excluding openai and pinecone since we handle them from env)
      const requiredOAuthConnections = analysisResult.requiredConnections.filter(conn => 
        conn !== 'openai' && conn !== 'pinecone'
      );
      const missingTokens = requiredOAuthConnections.filter(conn => !tokens[conn]);
      
      if (missingTokens.length > 0) {
        setDeploymentStatus('error');
        setDeploymentMessage(`Missing OAuth tokens for: ${missingTokens.join(', ')}. Please connect these services first.`);
        return;
      }
      
      let workflowTemplate;
      
      if (templateMatch && templateMatch.template) {
        // Use existing template
        setDeploymentMessage('Using existing template for deployment...');
        
        // Check if we have the actual template data, if not, load it using the template ID
        if (templateMatch.template.template) {
          workflowTemplate = templateMatch.template.template;
        } else {
          console.log('🔄 [N8N DEPLOYMENT] Template data missing, loading from backend API...');
          try {
            const templateId = templateMatch.template.id;
            const templateName = templateMatch.template.name;
            console.log('🔄 [N8N DEPLOYMENT] Loading template by ID:', templateId);
            console.log('🔄 [N8N DEPLOYMENT] Template name:', templateName);
            
            // Use the new template service to fetch content by ID
            workflowTemplate = await templateService.getTemplateContentById(templateId);
            
            console.log('✅ [N8N DEPLOYMENT] Successfully loaded template via API:', {
              templateId,
              templateName,
              hasNodes: !!workflowTemplate.nodes,
              nodeCount: workflowTemplate.nodes?.length || 0,
              hasConnections: !!workflowTemplate.connections
            });
            
          } catch (error) {
            console.error('❌ [N8N DEPLOYMENT] Failed to load template via API:', error);
            // Fallback to generating a new template
            setDeploymentMessage('Template loading failed, generating new workflow...');
            workflowTemplate = await llmService.generateWorkflowTemplate(analysisResult.analysis.requirements);
          }
        }
        
        console.log('🚀 [N8N DEPLOYMENT] Using existing template for deployment');
        console.log('🚀 [N8N DEPLOYMENT] Template name:', templateMatch.template.name);
        console.log('🚀 [N8N DEPLOYMENT] Template ID:', templateMatch.template.id);
        console.log('🚀 [N8N DEPLOYMENT] Template nodes count:', workflowTemplate?.nodes?.length || 0);
        console.log('🚀 [N8N DEPLOYMENT] Template connections:', Object.keys(workflowTemplate?.connections || {}));
        console.log('🚀 [N8N DEPLOYMENT] Full template data being deployed:', workflowTemplate);
      } else {
        // Generate new workflow template
        setDeploymentMessage('Generating n8n workflow template...');
        workflowTemplate = await llmService.generateWorkflowTemplate(analysisResult.analysis.requirements);
        
        console.log('🚀 [N8N DEPLOYMENT] Generated new workflow template');
        console.log('🚀 [N8N DEPLOYMENT] Generated template:', workflowTemplate);
      }
      
      // Validate template structure after loading
      if (!workflowTemplate) {
        throw new Error('Failed to load workflow template - template is null or undefined');
      }
      
      if (!workflowTemplate.nodes || !Array.isArray(workflowTemplate.nodes)) {
        throw new Error('Invalid template structure - missing or invalid nodes array');
      }
      
      if (workflowTemplate.nodes.length === 0) {
        console.warn('⚠️ [N8N DEPLOYMENT] Template has no nodes - this may cause deployment issues');
      }
      
      if (!workflowTemplate.connections || typeof workflowTemplate.connections !== 'object') {
        console.warn('⚠️ [N8N DEPLOYMENT] Template missing connections object - using empty connections');
        workflowTemplate.connections = {};
      }
      
      console.log('✅ [N8N DEPLOYMENT] Template validation passed:', {
        nodeCount: workflowTemplate.nodes.length,
        hasConnections: Object.keys(workflowTemplate.connections).length > 0,
        hasSettings: !!workflowTemplate.settings,
        templateKeys: Object.keys(workflowTemplate)
      });
      
      // Add Google OAuth token for Google nodes if needed (after template is loaded)
      const hasGoogleNodes = workflowTemplate && (
        JSON.stringify(workflowTemplate).includes('gmail') ||
        JSON.stringify(workflowTemplate).includes('googleDrive') ||
        JSON.stringify(workflowTemplate).includes('gmailOAuth2') ||
        JSON.stringify(workflowTemplate).includes('googleDriveOAuth2Api') ||
        workflowTemplate.nodes?.some((node: any) => 
          node.type === 'n8n-nodes-base.gmail' || 
          node.type === 'n8n-nodes-base.googleDrive' ||
          (node.credentials && (
            node.credentials.gmailOAuth2 || 
            node.credentials.googleDriveOAuth2Api ||
            node.credentials.googleOAuth2Api
          ))
        )
      );

      if (hasGoogleNodes) {
        console.log('🔍 [N8N DEPLOYMENT] Google integration detected, checking for OAuth tokens...');
        
        try {
          // Get Google OAuth token from the existing OAuth token service
          const googleToken = await oauthTokenService.getGoogleToken();
          
          if (googleToken && googleToken.accessToken) {
            tokens['google_header'] = googleToken;
            console.log('🔑 [N8N DEPLOYMENT] Added Google OAuth token for header authentication');
            console.log('🔑 [N8N DEPLOYMENT] Google token scopes:', googleToken.scopes);
          } else {
            console.warn('⚠️ [N8N DEPLOYMENT] Google OAuth token not found or invalid');
            console.warn('⚠️ [N8N DEPLOYMENT] Google nodes may not work properly without authentication');
            // Don't fail deployment, just warn - user needs to connect Google account
          }
        } catch (error) {
          console.error('❌ [N8N DEPLOYMENT] Failed to retrieve Google OAuth token:', error);
          console.warn('⚠️ [N8N DEPLOYMENT] Google nodes may not work without proper authentication');
          // Don't fail deployment, just warn
        }
      }
      
      setDeploymentMessage('Deploying workflow to n8n...');
      
      // Prepare deployment config
      const deploymentConfig: WorkflowDeploymentConfig = {
        workflowName: `${analysisResult.analysis.requirements.name}_${Date.now()}`,
        workflowData: workflowTemplate,
        credentials: {}, // Will be populated by n8n integration service
        oauthTokens: tokens,
        agentPrompts: {} // Can be populated for AI nodes
      };
      
      // Deploy to n8n
      const result = await n8nIntegrationService.deployWorkflow(deploymentConfig);
      
      if (result.success) {
        setWorkflowId(result.workflowId);
        setDeploymentStatus('success');
        setDeploymentMessage(result.message);
      } else {
        setDeploymentStatus('error');
        setDeploymentMessage(result.message);
      }
    } catch (error) {
      console.error('❌ [N8N DEPLOYMENT] Workflow deployment failed:', error);
      
      // Provide more descriptive error messages based on error type
      let errorMessage = 'Deployment failed: Unknown error';
      
      if (error instanceof Error) {
        errorMessage = `Deployment failed: ${error.message}`;
        
        // Provide specific guidance for common errors
        if (error.message.includes('workflowTemplate')) {
          errorMessage += '\n\nThis appears to be a template loading issue. Please try again or select a different template.';
        } else if (error.message.includes('credential')) {
          errorMessage += '\n\nThis appears to be a credential configuration issue. Please check your OAuth connections.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += '\n\nThis appears to be a network connectivity issue. Please check your n8n connection.';
        }
      } else if (typeof error === 'string') {
        errorMessage = `Deployment failed: ${error}`;
      } else {
        errorMessage = `Deployment failed: ${String(error)}`;
      }
      
      console.error('❌ [N8N DEPLOYMENT] Error details:', {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace available',
        hasWorkflowTemplate: typeof workflowTemplate !== 'undefined' ? !!workflowTemplate : false,
        workflowTemplateNodeCount: typeof workflowTemplate !== 'undefined' ? (workflowTemplate?.nodes?.length || 0) : 'N/A',
        tokenKeys: Object.keys(tokens)
      });
      
      setDeploymentStatus('error');
      setDeploymentMessage(errorMessage);
    }
  };
  */

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleTestAgent = () => {
    if (savedAgentId) {
      setShowDatabaseChat(true); // Re-purposing this modal
    } else {
      console.error("No saved agent ID found to initiate chat.");
      alert("Could not start chat. Agent ID is missing.");
    }
  };

  const handleConnectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildSession) {
      console.error("Build session is missing, cannot continue.");
      alert("Error: Build session not found.");
      return;
    }

    // Show a loading or processing state in the UI
    // For now, we just log it. A real UI would show a spinner in the modal.
    console.log("Submitting credentials to the architect...");

    try {
      // 1. Construct the connection string
      const connString = `postgresql://${connectionConfig.username}:${connectionConfig.password}@${connectionConfig.hostname}:${connectionConfig.port}/${connectionConfig.database}`;

      // 2. Call the continue endpoint
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/builds/${buildSession.build_id}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: {
            connection_string: connString,
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to continue build process.');
      }

      const updatedSession: BuildSession = await response.json();
      
      // 3. Update the frontend's state with the new session from the backend
      // The useEffect hook that listens to `buildSession` will handle the rest (e.g., closing the modal or showing an error).
      setBuildSession(updatedSession);

    } catch (error) {
      console.error("Error continuing build process:", error);
      alert(`An error occurred: ${error.message}`);
    }
  };

  const handleUploadEnv = () => {
    // This is a placeholder for now. 
    // In a real implementation, you would parse the .env file and call handleConnectionSubmit.
    alert("Functionality to parse .env files is not yet implemented.");
  };

  const handleDatabaseChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (databaseInput.trim() && savedAgentId) {
      const userMessageContent = databaseInput.trim();
      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        type: 'user',
        content: userMessageContent,
        timestamp: new Date()
      };
      setDatabaseMessages(prev => [...prev, userMessage]);
      setDatabaseInput('');
      
      // Start thinking process
      setIsDatabaseThinking(true);
      setThinkingPhase('thinking');

      try {
        const chatRequest = {
          session_id: `session_${savedAgentId}`, // Simple session management for now
          user_email: "fahadpatel5700@gmail.com", // Replace with actual logged-in user email
          message: userMessageContent,
        };

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/agents/${savedAgentId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatRequest),
        });

        if (!response.ok) {
          throw new Error("Failed to get response from agent");
        }

        const agentResponse = await response.json();

        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          type: 'agent',
          content: agentResponse.response,
          timestamp: new Date()
        };
        setDatabaseMessages(prev => [...prev, agentMessage]);

      } catch (error) {
        console.error("Error chatting with agent:", error);
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          type: 'agent',
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date()
        };
        setDatabaseMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsDatabaseThinking(false);
        setThinkingPhase(null);
      }
    }
  };

  // Function to generate nodes based on a template
  /*
  const generateTemplateBasedArchitecture = (template: BackendTemplateSearchResult['template']) => {
    const newNodes: Node[] = [];
    let xOffset = 20;

    // Add OpenAI node
    newNodes.push({
      id: 'openai',
      type: 'custom',
      position: { x: xOffset, y: 20 },
      data: { 
        label: 'OpenAI', 
        icon: '/images/openai-icon.png', 
        type: 'openai',
        isLoading: true 
      }
    });
    xOffset += 100;

    // Add nodes based on template structure if available
    console.log('🔍 [ARCHITECTURE GEN] Template structure check:', {
      hasTemplate: !!template,
      hasTemplateProperty: !!(template?.template),
      hasNodes: !!(template?.template?.nodes),
      isNodesArray: Array.isArray(template?.template?.nodes),
      nodeCount: template?.template?.nodes?.length || 0
    });
    
    if (template?.template?.nodes && Array.isArray(template.template.nodes) && template.template.nodes.length > 0) {
      console.log(`🔍 [ARCHITECTURE GEN] Processing ${template.template.nodes.length} template nodes`);
      template.template.nodes.forEach((node: any) => {
        newNodes.push({
          id: node.id || `node-${xOffset}`,
          type: 'custom',
          position: { x: xOffset, y: 20 },
          data: { 
            label: node.name || node.label || 'Node', 
            icon: '/images/default-icon.png', 
            type: 'template-node',
            isLoading: true 
          }
        });
        xOffset += 100;
      });
    } else {
      // Fallback to required connections if template structure is not available
      console.log('🔍 [ARCHITECTURE GEN] Template nodes not available, using required connections fallback');
      const connections = template?.requiredConnections || [];
      console.log('🔍 [ARCHITECTURE GEN] Required connections:', connections);
      
      if (Array.isArray(connections) && connections.length > 0) {
        connections.forEach(connection => {
          newNodes.push({
            id: connection,
            type: 'custom',
            position: { x: xOffset, y: 20 },
            data: { 
              label: connection.charAt(0).toUpperCase() + connection.slice(1), 
              icon: `/images/${connection}-icon.png`, 
              type: connection,
              isLoading: true 
            }
          });
          xOffset += 100;
        });
      } else {
        console.log('🔍 [ARCHITECTURE GEN] No template nodes or required connections available');
      }
    }

    // Add memory node
    newNodes.push({
      id: 'memory',
      type: 'custom',
      position: { x: 70, y: 80 },
      data: { 
        label: 'Memory', 
        icon: '/images/memory-icon.png', 
        type: 'memory',
        isLoading: true 
      }
    });

    setNodes(newNodes);
  };
  */

  // Function to generate generic connection-based architecture
  const generateGenericArchitecture = (requiredConnections: string[]) => {
    const newNodes: Node[] = [];
    let xOffset = 20;

    // Always add OpenAI node
    newNodes.push({
      id: 'openai',
      type: 'custom',
      position: { x: xOffset, y: 20 },
      data: { 
        label: 'OpenAI', 
        icon: '/images/openai-icon.png', 
        type: 'openai',
        isLoading: true 
      }
    });
    xOffset += 100;

    // Add connection-specific nodes
    if (requiredConnections.includes('google')) {
      newNodes.push({
        id: 'google',
        type: 'custom',
        position: { x: xOffset, y: 20 },
        data: { 
          label: 'Google', 
          icon: '/images/google-icon.png', 
          type: 'google',
          isLoading: true 
        }
      });
      xOffset += 100;
    }

    if (requiredConnections.includes('jira')) {
      newNodes.push({
        id: 'jira',
        type: 'custom',
        position: { x: xOffset, y: 20 },
        data: { 
          label: 'Jira', 
          icon: '/images/jira-icon.png', 
          type: 'jira',
          isLoading: true 
        }
      });
      xOffset += 100;
    }

    if (requiredConnections.includes('slack')) {
      newNodes.push({
        id: 'slack',
        type: 'custom',
        position: { x: xOffset, y: 20 },
        data: { 
          label: 'Slack', 
          icon: '/images/slack-icon.png', 
          type: 'slack',
          isLoading: true 
        }
      });
      xOffset += 100;
    }

    // Add memory node
    newNodes.push({
      id: 'memory',
      type: 'custom',
      position: { x: 70, y: 80 },
      data: { 
        label: 'Memory', 
        icon: '/images/memory-icon.png', 
        type: 'memory',
        isLoading: true 
      }
    });

    setNodes(newNodes);
  };

  const checkPrerequisites = async (config: AgentConfiguration): Promise<string[]> => {
    const unmet: string[] = [];
    // Add any additional prerequisites checks you want to execute
    return unmet;
  };

  const saveAgentConfig = async (config: AgentConfiguration) => {
    try {
      const agentData = {
        user_email: "fahadpatel5700@gmail.com", // Replace with actual logged-in user email
        name: config.agent_name || "New Agent",
        system_prompt: config.system_prompt || "You are a helpful assistant.",
        configuration: {
          tools_to_activate: config.tools_to_activate || [],
          prerequisites: config.prerequisites || {},
          llm_model: config.llm_model || "gpt-4o",
          pinecone_index_name: config.prerequisites?.pinecone_index_name || null
        }
      };

      const saveResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save agent configuration');
      }

      const savedAgent = await saveResponse.json();
      setSavedAgentId(savedAgent.id);
      console.log("Agent saved with ID:", savedAgent.id);
    } catch(error) {
      console.error("Error saving agent:", error);
    }
  };

  return (
    <div className="flex-1 flex h-screen pt-24">
      {/* Left Panel - Chat Window */}
      <div className="w-1/2 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Chat Messages Container */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-4">
            {chatMessages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md rounded-2xl px-4 py-3 ${
                  message.type === 'user' 
                    ? 'bg-orange-500 dark:bg-gray-600 text-white' 
                    : 'bg-transparent text-gray-900 dark:text-white'
                }`}>
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                </div>
              </div>
            ))}
            
            {/* Thinking Animation */}
            {showThinking && (
              <div className="flex justify-start">
                <div className="max-w-md rounded-2xl px-4 py-3 bg-transparent text-gray-900 dark:text-white">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Typing Effect */}
            {showProjectPlan && currentTypingIndex < projectPlanText.length && (
              <div className="flex justify-start">
                <div className="max-w-md rounded-2xl px-4 py-3 bg-transparent text-gray-900 dark:text-white">
                  <p className="text-sm whitespace-pre-line">
                    {typingText}
                    <span className="animate-pulse">|</span>
                  </p>
                </div>
              </div>
            )}
            
            {/* Project Approval Buttons */}
            {canApprove && (
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={handleProjectApproval}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 dark:bg-[#8B5CF6] dark:hover:bg-[#A855F7] text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-orange-500/25 dark:hover:shadow-[#8B5CF6]/25"
                >
                  Approve & Build
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Input - Fixed at bottom */}
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            <button
              onClick={() => {
                setShowKnowledgeBaseModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Upload Documents for Knowledge Base
            </button>
          </div>
          <form onSubmit={handleSendMessage} className="relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim()) {
                    handleSendMessage(e);
                  }
                }
              }}
              placeholder="Type a message..."
              className="w-full h-32 px-4 py-4 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-[#8B5CF6] focus:border-transparent text-lg transition-colors duration-300"
              disabled={isBuilding || showThinking}
            />
            
            <div className="absolute bottom-4 left-4 flex space-x-2 z-20">
              <button
                type="button"
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>

            {/* Send Button - appears when typing */}
            <div className={`absolute top-4 right-4 transition-all duration-300 ease-out ${
              newMessage.trim() 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-75 translate-y-2 pointer-events-none'
            }`}>
              <button
                type="submit"
                disabled={!newMessage.trim() || isBuilding || showThinking}
                className="w-10 h-10 bg-orange-500 hover:bg-orange-600 dark:bg-[#8B5CF6] dark:hover:bg-[#A855F7] disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-orange-500/25 dark:hover:shadow-[#8B5CF6]/25"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Progress/Architecture */}
      <div className="w-1/2 flex flex-col overflow-y-auto">
        {showArchitecture ? (
          // Architecture View with React Flow
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Building Architecture</h2>
            
            {/* AI Agent Container */}
            <div className="relative bg-white rounded-lg border-2 border-gray-200 p-6 mb-4 h-64" 
                 style={{
                   backgroundSize: '20px 20px'
                 }}>
              
              {/* React Flow Diagram */}
              <div className="h-56 w-full">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.1 }}
                  attributionPosition="bottom-left"
                  className="bg-transparent"
                  proOptions={{ hideAttribution: true }}
                  minZoom={0.5}
                  maxZoom={1.5}
                >
                  <Background color="#9ca3af" gap={20} />
                </ReactFlow>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {nodes.length === 0 
                  ? 'Analyzing requirements...' 
                  : nodes.length > 0 && edges.length === 0 
                    ? 'Connecting components...' 
                    : edges.length > 0 
                      ? 'Architecture complete! Starting build...' 
                      : 'Setting up architecture...'}
              </p>
            </div>

            {/* Build Steps - Only visible after architecture is complete and user has approved */}
            {(isBuilding || isAgentReady) && showArchitecture && projectApproved && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Build Progress</h3>
                <div className="space-y-3">
                  {buildSteps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      {index === currentStepIndex && isBuilding ? (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <HashLoader size={20} color="#8B5CF6" />
                        </div>
                      ) : (
                        <div className={`w-3 h-3 rounded-full ${
                          index < currentStepIndex ? 'bg-orange-500 dark:bg-[#8B5CF6]' :
                          index === currentStepIndex ? 'bg-orange-400 dark:bg-[#A855F7] animate-pulse' :
                          'bg-gray-300 dark:bg-gray-600'
                        }`} />
                      )}
                      <p className={`${
                        index <= currentStepIndex ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'
                      } transition-colors duration-300`}>
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Section - Fixed at bottom */}
            {isAgentReady && (
              <div className="mt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 dark:bg-[#8B5CF6]/10 border border-orange-200 dark:border-[#8B5CF6]/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-orange-600 dark:text-[#8B5CF6]" />
                      <div>
                        <p className="text-orange-800 dark:text-[#8B5CF6] font-medium transition-colors duration-300">Agent built successfully!</p>
                        <p className="text-orange-700 dark:text-[#A855F7] text-sm mt-1 transition-colors duration-300">
                          Your AI agent is ready for testing and deployment.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={handleTestAgent}
                      className="w-full bg-white hover:bg-gray-50 dark:bg-white dark:hover:bg-gray-200 text-gray-900 dark:text-black px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 border border-gray-200 dark:border-gray-300"
                    >
                      <Database className="h-5 w-5" />
                      <span>Test Agent</span>
                    </button>

                    <button
                      onClick={() => alert('Agent deployed successfully!')}
                      className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-[#8B5CF6] dark:hover:bg-[#A855F7] text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                      <Zap className="h-5 w-5" />
                      <span>Deploy Agent</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Build Progress View (when architecture is hidden)
          <>
            {((isBuilding || isAgentReady) && projectApproved) ? (
              <>
                <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 transition-colors duration-300">Build Progress</h2>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                    <div
                      className="bg-orange-500 dark:bg-[#8B5CF6] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${buildProgress}%` }}
                    />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">{Math.round(buildProgress)}% complete</p>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="space-y-4">
                    {buildSteps.map((step, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        {index === currentStepIndex && isBuilding ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <HashLoader size={20} color="#8B5CF6" />
                          </div>
                        ) : (
                          <div className={`w-3 h-3 rounded-full ${
                            index < currentStepIndex ? 'bg-orange-500 dark:bg-[#8B5CF6]' :
                            index === currentStepIndex ? 'bg-orange-400 dark:bg-[#A855F7] animate-pulse' :
                            'bg-gray-300 dark:bg-gray-600'
                          }`} />
                        )}
                        <p className={`${
                          index <= currentStepIndex ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'
                        } transition-colors duration-300`}>
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Success Section - Fixed at bottom */}
                {isAgentReady && (
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-orange-50 dark:bg-[#8B5CF6]/10 border border-orange-200 dark:border-[#8B5CF6]/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-orange-600 dark:text-[#8B5CF6]" />
                          <div>
                            <p className="text-orange-800 dark:text-[#8B5CF6] font-medium transition-colors duration-300">Agent built successfully!</p>
                            <p className="text-orange-700 dark:text-[#A855F7] text-sm mt-1 transition-colors duration-300">
                              Your AI agent is ready for testing and deployment.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={handleTestAgent}
                          className="w-full bg-white hover:bg-gray-50 dark:bg-white dark:hover:bg-gray-200 text-gray-900 dark:text-black px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 border border-gray-200 dark:border-gray-300"
                        >
                          <Database className="h-5 w-5" />
                          <span>Test Agent</span>
                        </button>

                        <button
                          onClick={() => alert('Agent deployed successfully!')}
                          className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-[#8B5CF6] dark:hover:bg-[#A855F7] text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                        >
                          <Zap className="h-5 w-5" />
                          <span>Deploy Agent</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto">
                <div className="relative w-full max-w-3xl min-h-[980px]">
                  {/* Connector background (subtle) */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute left-1/2 top-20 bottom-56 w-px -translate-x-1/2 bg-gray-200 dark:bg-gray-700" />
                  </div>

                  {/* New Lead Added - top center */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-4 w-[360px]">
                    <div className="flex items-center bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="w-7 h-7 mr-3 rounded-lg bg-emerald-50 border border-emerald-300 flex items-center justify-center">
                        <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">New Lead Added</div>
                    </div>
                  </div>


                  {/* Call Lead - below center, with more space below */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-[100px] w-[360px]">
                    <div className="flex items-center bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="w-7 h-7 mr-3 rounded-lg bg-yellow-50 border border-yellow-300 flex items-center justify-center">
                        <svg className="h-4 w-4 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">Call Lead</div>
                    </div>
                  </div>

                  {/* Small pill: After call ends (center), with more space below Call Lead */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-[160px] z-10">
                    <div className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm shadow-sm border border-gray-200 dark:border-gray-700">After call ends</div>
                  </div>

                  {/* Dashed line from After call ends to blue card */}
                  <svg className="absolute left-1/2 -translate-x-1/2 z-0" style={{ top: '180px' }} width="2" height="40" viewBox="0 0 2 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="1" y1="0" x2="1" y2="40" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 6" />
                  </svg>

                  {/* Small pill: After call begins (right) + plus button */}
                  <div className="absolute right-8 top-[140px] flex items-center space-x-3">
                    <div className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm shadow-sm border border-gray-200 dark:border-gray-700">After call begins</div>
                    <div className="h-7 w-7 rounded-full bg-white dark:bg-transparent border border-sky-300 dark:border-sky-700 flex items-center justify-center text-sky-500">
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Pitch Product & Qualify Lead - big blue card center */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-[180px] w-[520px]">
                    <div className="relative rounded-2xl border-2 border-sky-300 dark:border-sky-700 bg-white dark:bg-transparent shadow-[0_0_0_4px_rgba(125,211,252,0.2)] p-5">
                      <div className="flex items-start">
                        <div className="w-8 h-8 mr-3 rounded-lg border-2 border-sky-400 dark:border-sky-600 flex items-center justify-center">
                          <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white">Pitch Product & Qualify Lead</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">You are calling a lead to pitch...</div>
                          <div className="mt-2 inline-flex items-center rounded-md bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-2 py-1">
                            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-.376a1 1 0 01.894 1.447L17 17l-2-2-3 3-4-4 3-3-2-2 5.93-3.37A1 1 0 0116 6v4z" /></svg>
                            Call
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Plus button near pitch card (right side) */}
                  <div className="absolute right-8 top-[235px] h-8 w-8 rounded-full bg-white dark:bg-transparent border border-sky-300 dark:border-sky-700 flex items-center justify-center text-sky-500 shadow-sm">
                    <Plus className="h-4 w-4" />
                  </div>

                  {/* Pill: The agent has finished pitching... */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-[220px]">
                    <div className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm shadow-sm border border-gray-200 dark:border-gray-700">The agent has finished pit...</div>
                  </div>

                  {/* Check Calendar Availability - left */}
                  <div className="absolute left-8 top-[410px] w-[360px]">
                    <div className="flex items-center bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-4 shadow-sm">
                      <div className="w-7 h-7 mr-3 rounded-lg bg-sky-50 border border-sky-300 flex items-center justify-center">
                        <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">Check Calendar Availability</div>
                    </div>
                  </div>

                  {/* Lead Interested? - right */}
                  <div className="absolute right-8 top-[410px] w-[360px]">
                    <div className="flex items-center bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-4 shadow-sm">
                      <div className="w-7 h-7 mr-3 rounded-lg bg-purple-50 border border-purple-300 flex items-center justify-center">
                        <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">Lead Interested?</div>
                    </div>
                  </div>

                  {/* Plus button near Lead Interested (right side) */}
                  <div className="absolute right-8 top-[470px] h-8 w-8 rounded-full bg-white dark:bg-transparent border border-sky-300 dark:border-sky-700 flex items-center justify-center text-sky-500 shadow-sm">
                    <Plus className="h-4 w-4" />
                  </div>

                  {/* Pill: Interested (center under mid boxes) */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-[500px]">
                    <div className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm shadow-sm border border-gray-200 dark:border-gray-700">Interested</div>
                  </div>

                  {/* Collect Email & Book Call - large bottom center */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-[620px] w-[520px]">
                    <div className="rounded-2xl border-2 border-sky-300 dark:border-sky-700 bg-white dark:bg-transparent shadow-[0_0_0_4px_rgba(125,211,252,0.2)] p-5">
                      <div className="flex items-start">
                        <div className="w-8 h-8 mr-3 rounded-lg border-2 border-sky-400 dark:border-sky-600 flex items-center justify-center">
                          <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white">Collect Email & Book Call</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ask the lead for their email...</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analysis Logs - Only show during analysis phase */}
                  {logs.length > 0 && !showProjectPlan && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-[780px] w-[520px]">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Analysis Logs</h4>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                        {logs.slice(-5).map((log, index) => (
                          <div key={index} className="text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <KnowledgeBaseModal
        isOpen={showKnowledgeBaseModal}
        onClose={() => setShowKnowledgeBaseModal(false)}
        onSelectSource={(source) => {
          if (source === 'files') {
            setShowFileUploadModal(true);
          }
          console.log('Selected source:', source);
          setShowKnowledgeBaseModal(false);
        }}
      />

      <FileUploadModal
        isOpen={showFileUploadModal}
        onClose={() => setShowFileUploadModal(false)}
        onUpload={async (files) => {
          if (!buildSession) return;
          const formData = new FormData();
          formData.append("file", files[0]);

          try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8081'}/api/v1/builds/${buildSession.build_id}/upload_file`, {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              throw new Error("Failed to upload file");
            }

            const updatedSession: BuildSession = await response.json();
            setBuildSession(updatedSession);
          } catch (error) {
            console.error("Error uploading file:", error);
          }
        }}
      />

      {/* PostgreSQL Connection Modal */}
      {showConnectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Database Connection</h3>
                <button
                  onClick={() => setShowConnectionModal(false)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex space-x-3">
                  <button
                    onClick={handleUploadEnv}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-orange-500 dark:hover:border-[#8B5CF6] transition-colors duration-200"
                  >
                    <Upload className="h-5 w-5" />
                    <span>Upload .env file</span>
                  </button>
                </div>

                <div className="text-center text-gray-500 dark:text-gray-400">or</div>

                <form onSubmit={handleConnectionSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hostname</label>
                    <input
                      type="text"
                      value={connectionConfig.hostname}
                      onChange={(e) => setConnectionConfig(prev => ({ ...prev, hostname: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-[#8B5CF6]"
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                    <input
                      type="text"
                      value={connectionConfig.username}
                      onChange={(e) => setConnectionConfig(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-[#8B5CF6]"
                      placeholder="postgres"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <input
                      type="password"
                      value={connectionConfig.password}
                      onChange={(e) => setConnectionConfig(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-[#8B5CF6]"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database</label>
                    <input
                      type="text"
                      value={connectionConfig.database}
                      onChange={(e) => setConnectionConfig(prev => ({ ...prev, database: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-[#8B5CF6]"
                      placeholder="mydatabase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                    <input
                      type="text"
                      value={connectionConfig.port}
                      onChange={(e) => setConnectionConfig(prev => ({ ...prev, port: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-[#8B5CF6]"
                      placeholder="5432"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-orange-500 hover:bg-orange-600 dark:bg-[#8B5CF6] dark:hover:bg-[#A855F7] text-white px-6 py-3 rounded-lg font-medium transition-all duration-200"
                  >
                    Connect to Database
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Chat Modal */}
      {showDatabaseChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Agent Chat</h3>
                  <p className="text-sm text-green-600 dark:text-green-400">Connected</p>
                </div>
              </div>
              <button
                onClick={() => setShowDatabaseChat(false)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex justify-start">
                <div className="max-w-md px-4 py-3 rounded-2xl bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                  <p className="text-sm leading-relaxed">
                    Hi! I am your AI agent. I'm now connected and ready to help you with your tasks. Ask me anything and I'll provide you with detailed insights and assistance based on my capabilities.
                  </p>
                </div>
              </div>
              
              {/* Database Chat Messages */}
              {databaseMessages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-md rounded-2xl px-4 py-3 ${
                    message.type === 'user' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                  }`}>
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {/* Thinking Animation */}
              {isDatabaseThinking && (
                <div className="flex justify-start">
                  <div className="max-w-md rounded-2xl px-4 py-3 bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-green-600 dark:text-green-400">
                        {thinkingPhase === 'thinking' && 'Thinking...'}
                        {thinkingPhase === 'extracting' && 'Extracting data...'}
                        {thinkingPhase === 'consolidating' && 'Consolidating final response...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-6">
              <form onSubmit={handleDatabaseChat} className="relative">
                <textarea
                  value={databaseInput}
                  onChange={(e) => setDatabaseInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (databaseInput.trim() && !isDatabaseThinking) {
                        handleDatabaseChat(e);
                      }
                    }
                  }}
                  placeholder="Chat with your new agent..."
                  disabled={isDatabaseThinking}
                  className="w-full h-24 px-4 py-4 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="absolute top-4 right-4">
                  <button
                    type="submit"
                    disabled={!databaseInput.trim() || isDatabaseThinking}
                    className="w-10 h-10 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-green-500/25"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}