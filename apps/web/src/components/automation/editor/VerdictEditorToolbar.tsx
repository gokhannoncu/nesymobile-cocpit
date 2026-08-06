'use client';

import React, { useState } from 'react';
import { CompilePreviewPanel } from './CompilePreviewPanel';
import { SemanticActionPalette } from './SemanticActionPalette';
import { EntityBindingEditor } from './EntityBindingEditor';
import { TargetFingerprintForm } from './TargetFingerprintForm';
import { OracleRequirementEditor } from './OracleRequirementEditor';
import { ContinueGateEditor } from './ContinueGateEditor';
import { FinalOracleEditor } from './FinalOracleEditor';
import { LaunchProfileBuilder } from './LaunchProfileBuilder';
import { EvidenceSourceRegistry } from '../evidence/EvidenceSourceRegistry';
import { TargetResolutionPanel } from '../evidence/TargetResolutionPanel';
import { ListTree, MousePointer2, Database, ShieldCheck, Rocket } from 'lucide-react';

type TabId = 'compile' | 'actions' | 'bindings' | 'oracles' | 'launch';

export function VerdictEditorToolbar({ workflowState }: { workflowState?: any }) {
  const [activeTab, setActiveTab] = useState<TabId>('compile');

  return (
    <div className="w-[350px] flex flex-col h-full bg-gray-50 border-l border-gray-200">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('compile')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 flex flex-col items-center gap-1 ${activeTab === 'compile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ListTree size={16} /> Preview
        </button>
        <button 
          onClick={() => setActiveTab('actions')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 flex flex-col items-center gap-1 ${activeTab === 'actions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <MousePointer2 size={16} /> Actions
        </button>
        <button 
          onClick={() => setActiveTab('bindings')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 flex flex-col items-center gap-1 ${activeTab === 'bindings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Database size={16} /> Data
        </button>
        <button 
          onClick={() => setActiveTab('oracles')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 flex flex-col items-center gap-1 ${activeTab === 'oracles' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ShieldCheck size={16} /> Rules
        </button>
        <button 
          onClick={() => setActiveTab('launch')}
          className={`flex-1 py-2 text-xs font-medium border-b-2 flex flex-col items-center gap-1 ${activeTab === 'launch' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Rocket size={16} /> Config
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-2 space-y-4">
        {activeTab === 'compile' && (
          <div className="h-full bg-white rounded shadow-sm border overflow-hidden">
            <CompilePreviewPanel workflowState={workflowState} />
          </div>
        )}
        
        {activeTab === 'actions' && (
          <div className="h-full bg-white rounded shadow-sm border overflow-hidden">
            <SemanticActionPalette />
          </div>
        )}

        {activeTab === 'bindings' && (
          <>
            <EntityBindingEditor />
            <TargetFingerprintForm />
            <TargetResolutionPanel />
          </>
        )}

        {activeTab === 'oracles' && (
          <>
            <ContinueGateEditor />
            <FinalOracleEditor />
            <OracleRequirementEditor />
          </>
        )}

        {activeTab === 'launch' && (
          <>
            <LaunchProfileBuilder />
            <EvidenceSourceRegistry
              runId={
                typeof workflowState?.runId === 'string' ? workflowState.runId : undefined
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
