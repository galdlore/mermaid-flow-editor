import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_GITGRAPH_BRANCH_CHARS_REGEX,
  FORBIDDEN_GITGRAPH_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import {
  sanitizeGitGraphBranchName,
  simulateGitGraphState,
} from '../utils/gitGraphConverter';
import type {
  GitGraphCommitType,
  GitGraphDiagramData,
  GitGraphOperationData,
  GitGraphOperationKind,
  GitGraphOrientation,
} from '../types/editor';

export interface GitGraphInspectorProps {
  gitData: GitGraphDiagramData;
  selectedOperationId: string | null;
  onChange: (next: GitGraphDiagramData) => void;
  onSelectOperation: (opId: string | null) => void;
}

type GitSectionKey = 'operation' | 'settings' | 'comments';

const OP_KINDS: GitGraphOperationKind[] = [
  'commit',
  'branch',
  'checkout',
  'merge',
  'cherry-pick',
];

const COMMIT_TYPES: GitGraphCommitType[] = ['NORMAL', 'HIGHLIGHT', 'REVERSE'];
const ORIENTATIONS: GitGraphOrientation[] = ['LR', 'TB', 'BT'];

export default function GitGraphInspector({
  gitData,
  selectedOperationId,
  onChange,
  onSelectOperation,
}: GitGraphInspectorProps) {
  const { t } = useI18n();
  const gg = t.inspector.gitGraph;
  const safeguard = t.inspector.safeguard;

  const selectedIndex = gitData.operations.findIndex(
    (o) => o.id === selectedOperationId
  );
  const selectedOp =
    selectedIndex >= 0 ? gitData.operations[selectedIndex] : null;

  const sim = useMemo(() => simulateGitGraphState(gitData), [gitData]);
  const currentStep = selectedIndex >= 0 ? sim.steps[selectedIndex] : null;
  const previousStep = selectedIndex > 0 ? sim.steps[selectedIndex - 1] : null;
  const availableBranches = previousStep?.knownBranches ?? [
    gitData.mainBranchName ?? 'main',
  ];
  const availableCommits = previousStep?.knownCommitIds ?? sim.allCommitIds;

  const [mainBranchDraft, setMainBranchDraft] = useState(
    gitData.mainBranchName ?? 'main'
  );
  const [openSections, setOpenSections] = useState<
    Record<GitSectionKey, boolean>
  >({
    operation: true,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    setMainBranchDraft(gitData.mainBranchName ?? 'main');
  }, [gitData.mainBranchName]);

  useEffect(() => {
    if (selectedOperationId) {
      setOpenSections((prev) =>
        prev.operation ? prev : { ...prev, operation: true }
      );
    }
  }, [selectedOperationId]);

  const toggleSection = (key: GitSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({ operation: open, settings: open, comments: open });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelectedOp = (patch: Partial<GitGraphOperationData>): void => {
    if (!selectedOp) return;
    onChange({
      ...gitData,
      operations: gitData.operations.map((o) =>
        o.id === selectedOp.id ? { ...o, ...patch } : o
      ),
    });
  };

  const handleKindChange = (nextKind: GitGraphOperationKind): void => {
    if (!selectedOp) return;
    const patch: Partial<GitGraphOperationData> = { kind: nextKind };
    if (
      (nextKind === 'branch' ||
        nextKind === 'checkout' ||
        nextKind === 'merge') &&
      !selectedOp.branchName
    ) {
      patch.branchName =
        nextKind === 'branch' ? 'feature' : availableBranches[0] ?? 'main';
    }
    if (nextKind === 'cherry-pick' && !selectedOp.commitId) {
      patch.commitId = availableCommits[0] ?? 'c1';
    }
    updateSelectedOp(patch);
  };

  const handleDeleteSelected = (): void => {
    if (!selectedOp) return;
    const next = gitData.operations.filter((o) => o.id !== selectedOp.id);
    onChange({ ...gitData, operations: next });
    onSelectOperation(
      next[Math.min(selectedIndex, next.length - 1)]?.id ?? null
    );
  };

  const warningMessage = currentStep?.warning
    ? gg.warnings[currentStep.warning as keyof typeof gg.warnings]
    : undefined;

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={gg.operationSection}
        badgeText={gitData.operations.length}
        isOpen={openSections.operation}
        onToggle={() => toggleSection('operation')}
      >
        {selectedOp ? (
          <>
            {warningMessage && (
              <div className="gitgraph-inspector-warning">{warningMessage}</div>
            )}

            <label className="inspector-field">
              <span>{gg.operationKindField}</span>
              <select
                value={selectedOp.kind}
                onChange={(e) =>
                  handleKindChange(e.target.value as GitGraphOperationKind)
                }
              >
                {OP_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {gg.operationKinds[k]}
                  </option>
                ))}
              </select>
            </label>

            {(selectedOp.kind === 'branch' ||
              selectedOp.kind === 'checkout' ||
              selectedOp.kind === 'merge') && (
              <label className="inspector-field">
                <span>{gg.branchNameField}</span>
                {selectedOp.kind === 'branch' ? (
                  <GuardedInput
                    value={selectedOp.branchName ?? ''}
                    placeholder={gg.branchNamePlaceholder}
                    forbiddenRegex={FORBIDDEN_GITGRAPH_BRANCH_CHARS_REGEX}
                    formatError={safeguard.gitBranchErrorChars}
                    onChangeValue={(branchName) =>
                      updateSelectedOp({ branchName })
                    }
                  />
                ) : (
                  <select
                    value={selectedOp.branchName ?? ''}
                    onChange={(e) =>
                      updateSelectedOp({ branchName: e.target.value })
                    }
                  >
                    {!availableBranches.includes(
                      selectedOp.branchName ?? ''
                    ) &&
                      selectedOp.branchName && (
                        <option value={selectedOp.branchName}>
                          {selectedOp.branchName}
                        </option>
                      )}
                    {availableBranches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}

            {selectedOp.kind === 'branch' && (
              <label className="inspector-field">
                <span>{gg.branchOrderField}</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={selectedOp.order ?? ''}
                  placeholder={gg.branchOrderPlaceholder}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (!val) {
                      updateSelectedOp({ order: undefined });
                      return;
                    }
                    const parsed = Number.parseInt(val, 10);
                    if (!Number.isNaN(parsed)) {
                      updateSelectedOp({
                        order: Math.max(0, Math.min(99, parsed)),
                      });
                    }
                  }}
                />
              </label>
            )}

            {(selectedOp.kind === 'commit' || selectedOp.kind === 'merge') && (
              <>
                <label className="inspector-field">
                  <span>{gg.commitIdField}</span>
                  <GuardedInput
                    value={selectedOp.commitId ?? ''}
                    placeholder={gg.commitIdPlaceholder}
                    forbiddenRegex={FORBIDDEN_GITGRAPH_TEXT_CHARS_REGEX}
                    formatError={safeguard.gitTextErrorChars}
                    onChangeValue={(val) =>
                      updateSelectedOp({ commitId: val || undefined })
                    }
                  />
                </label>

                <label className="inspector-field">
                  <span>{gg.commitTypeField}</span>
                  <select
                    value={selectedOp.commitType ?? 'NORMAL'}
                    onChange={(e) => {
                      const val = e.target.value as GitGraphCommitType;
                      updateSelectedOp({
                        commitType: val === 'NORMAL' ? undefined : val,
                      });
                    }}
                  >
                    {COMMIT_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {gg.commitTypes[ct]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {selectedOp.kind === 'cherry-pick' && (
              <>
                <label className="inspector-field">
                  <span>{gg.cherryPickTargetField}</span>
                  {availableCommits.length > 0 ? (
                    <select
                      value={selectedOp.commitId ?? ''}
                      onChange={(e) =>
                        updateSelectedOp({ commitId: e.target.value })
                      }
                    >
                      {!availableCommits.includes(
                        selectedOp.commitId ?? ''
                      ) &&
                        selectedOp.commitId && (
                          <option value={selectedOp.commitId}>
                            {selectedOp.commitId}
                          </option>
                        )}
                      {availableCommits.map((cid) => (
                        <option key={cid} value={cid}>
                          {cid}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <GuardedInput
                      value={selectedOp.commitId ?? ''}
                      placeholder="c1"
                      forbiddenRegex={FORBIDDEN_GITGRAPH_TEXT_CHARS_REGEX}
                      formatError={safeguard.gitTextErrorChars}
                      onChangeValue={(commitId) =>
                        updateSelectedOp({ commitId })
                      }
                    />
                  )}
                </label>

                <label className="inspector-field">
                  <span>{gg.cherryPickParentField}</span>
                  <GuardedInput
                    value={selectedOp.parent ?? ''}
                    placeholder={gg.cherryPickParentPlaceholder}
                    forbiddenRegex={FORBIDDEN_GITGRAPH_TEXT_CHARS_REGEX}
                    formatError={safeguard.gitTextErrorChars}
                    onChangeValue={(val) =>
                      updateSelectedOp({ parent: val || undefined })
                    }
                  />
                </label>
              </>
            )}

            {(selectedOp.kind === 'commit' ||
              selectedOp.kind === 'merge' ||
              selectedOp.kind === 'cherry-pick') && (
              <label className="inspector-field">
                <span>{gg.tagField}</span>
                <GuardedInput
                  value={selectedOp.tag ?? ''}
                  placeholder={gg.tagPlaceholder}
                  forbiddenRegex={FORBIDDEN_GITGRAPH_TEXT_CHARS_REGEX}
                  formatError={safeguard.gitTextErrorChars}
                  onChangeValue={(val) =>
                    updateSelectedOp({ tag: val || undefined })
                  }
                />
              </label>
            )}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelected}
            >
              <Trash2 size={14} />
              <span>{gg.deleteOperationBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{gg.selectOperationPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={gg.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{gg.titleField}</span>
          <GuardedInput
            value={gitData.title ?? ''}
            placeholder={gg.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_GITGRAPH_TEXT_CHARS_REGEX}
            formatError={safeguard.gitTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...gitData, title: val || undefined })
            }
          />
        </label>

        <div className="inspector-field">
          <span>{gg.orientationField}</span>
          <div className="direction-grid">
            {ORIENTATIONS.map((ori) => (
              <button
                key={ori}
                type="button"
                className={`inspector-choice-btn ${
                  gitData.orientation === ori ? 'is-active' : ''
                }`}
                onClick={() => onChange({ ...gitData, orientation: ori })}
              >
                {gg.orientations[ori]}
              </button>
            ))}
          </div>
        </div>

        <div
          className="inspector-field"
          onBlur={() => {
            const committed = sanitizeGitGraphBranchName(
              mainBranchDraft || 'main'
            );
            setMainBranchDraft(committed);
            if (committed !== (gitData.mainBranchName ?? 'main')) {
              onChange({ ...gitData, mainBranchName: committed });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const committed = sanitizeGitGraphBranchName(
                mainBranchDraft || 'main'
              );
              setMainBranchDraft(committed);
              if (committed !== (gitData.mainBranchName ?? 'main')) {
                onChange({ ...gitData, mainBranchName: committed });
              }
            }
          }}
        >
          <span>{gg.mainBranchField}</span>
          <GuardedInput
            value={mainBranchDraft}
            placeholder="main"
            forbiddenRegex={FORBIDDEN_GITGRAPH_BRANCH_CHARS_REGEX}
            formatError={safeguard.gitBranchErrorChars}
            onChangeValue={setMainBranchDraft}
          />
        </div>

        <label className="checkbox-field-label">
          <input
            type="checkbox"
            checked={gitData.showBranches !== false}
            onChange={(e) =>
              onChange({ ...gitData, showBranches: e.target.checked })
            }
          />
          <span>{gg.showBranchesField}</span>
        </label>

        <label className="checkbox-field-label">
          <input
            type="checkbox"
            checked={gitData.showCommitLabel !== false}
            onChange={(e) =>
              onChange({ ...gitData, showCommitLabel: e.target.checked })
            }
          />
          <span>{gg.showCommitLabelField}</span>
        </label>

        <label className="checkbox-field-label">
          <input
            type="checkbox"
            checked={gitData.rotateCommitLabel !== false}
            onChange={(e) =>
              onChange({ ...gitData, rotateCommitLabel: e.target.checked })
            }
          />
          <span>{gg.rotateCommitLabelField}</span>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={gg.commentsSection}
        fieldLabel={gg.commentsField}
        placeholder={gg.commentsPlaceholder}
        comments={gitData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...gitData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
