'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@nesy/metronic/lib/utils';
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

type TabId = 'compile' | 'actions' | 'bindings' | 'oracles' | 'launch';

const VERDICT_PANEL_TABS: { id: TabId; label: string }[] = [
  { id: 'compile', label: 'Preview' },
  { id: 'actions', label: 'Actions' },
  { id: 'bindings', label: 'Data' },
  { id: 'oracles', label: 'Rules' },
  { id: 'launch', label: 'Config' },
];

function VerdictPanelSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

function VerdictTabPanel({
  tabId,
  activeTab,
  mounted,
  children,
  className,
}: {
  tabId: TabId;
  activeTab: TabId;
  mounted: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!mounted) return null;

  const visible = activeTab === tabId;

  return (
    <div
      role="tabpanel"
      id={`verdict-panel-${tabId}`}
      aria-labelledby={`verdict-tab-${tabId}`}
      hidden={!visible}
      className={cn(
        'min-h-0 flex-1 flex-col',
        !visible && 'hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

function VerdictSegmentedTabs({
  activeTab,
  onChange,
}: {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-xl bg-slate-100/90 p-1"
      role="tablist"
      aria-label="Verdict panel sections"
    >
      {VERDICT_PANEL_TABS.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`verdict-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`verdict-panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-w-0 flex-1 rounded-lg px-1 py-2 text-center text-[11px] font-semibold leading-tight transition-all',
              selected
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-500 hover:bg-white/50 hover:text-slate-700',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function VerdictEditorToolbar({ workflowState }: { workflowState?: any }) {
  const [activeTab, setActiveTab] = useState<TabId>('compile');
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(['compile']));

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  return (
    <div className="flex h-full w-[350px] flex-col border-l border-slate-200/90 bg-[#F8FAFC]">
      <div className="shrink-0 border-b border-slate-200/90 bg-white px-3 pb-3 pt-3">
        <VerdictSegmentedTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <VerdictTabPanel tabId="compile" activeTab={activeTab} mounted={mountedTabs.has('compile')} className="flex">
          <VerdictPanelSection className="flex min-h-0 flex-1 flex-col">
            <CompilePreviewPanel workflowState={workflowState} />
          </VerdictPanelSection>
        </VerdictTabPanel>

        <VerdictTabPanel tabId="actions" activeTab={activeTab} mounted={mountedTabs.has('actions')} className="flex">
          <VerdictPanelSection className="flex min-h-0 flex-1 flex-col">
            <SemanticActionPalette />
          </VerdictPanelSection>
        </VerdictTabPanel>

        <VerdictTabPanel tabId="bindings" activeTab={activeTab} mounted={mountedTabs.has('bindings')} className="flex">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
            <VerdictPanelSection>
              <EntityBindingEditor />
            </VerdictPanelSection>
            <VerdictPanelSection>
              <TargetFingerprintForm />
            </VerdictPanelSection>
            <VerdictPanelSection>
              <TargetResolutionPanel />
            </VerdictPanelSection>
          </div>
        </VerdictTabPanel>

        <VerdictTabPanel tabId="oracles" activeTab={activeTab} mounted={mountedTabs.has('oracles')} className="flex">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
            <VerdictPanelSection>
              <ContinueGateEditor />
            </VerdictPanelSection>
            <VerdictPanelSection>
              <FinalOracleEditor />
            </VerdictPanelSection>
            <VerdictPanelSection>
              <OracleRequirementEditor />
            </VerdictPanelSection>
          </div>
        </VerdictTabPanel>

        <VerdictTabPanel tabId="launch" activeTab={activeTab} mounted={mountedTabs.has('launch')} className="flex">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
            <VerdictPanelSection>
              <LaunchProfileBuilder />
            </VerdictPanelSection>
            <VerdictPanelSection>
              <EvidenceSourceRegistry
                runId={typeof workflowState?.runId === 'string' ? workflowState.runId : undefined}
              />
            </VerdictPanelSection>
          </div>
        </VerdictTabPanel>
      </div>
    </div>
  );
}
