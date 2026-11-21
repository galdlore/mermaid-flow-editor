import { useState } from 'react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_INFO_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import type { InfoDiagramData } from '../types/editor';

export interface InfoInspectorProps {
  infoData: InfoDiagramData;
  onChange: (next: InfoDiagramData) => void;
}

type InfoSectionKey = 'info' | 'comments';

export default function InfoInspector({
  infoData,
  onChange,
}: InfoInspectorProps) {
  const { t } = useI18n();
  const inf = t.inspector.info;
  const safeguard = t.inspector.safeguard;

  const [openSections, setOpenSections] = useState<
    Record<InfoSectionKey, boolean>
  >({
    info: true,
    comments: false,
  });

  const toggleSection = (key: InfoSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({ info: open, comments: open });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={inf.infoSection}
        isOpen={openSections.info}
        onToggle={() => toggleSection('info')}
      >
        <label className="inspector-checkbox-row">
          <input
            type="checkbox"
            checked={infoData.showInfo}
            onChange={(e) =>
              onChange({ ...infoData, showInfo: e.target.checked })
            }
          />
          <span>{inf.showInfoField}</span>
        </label>
        <p className="inspector-hint">{inf.showInfoHint}</p>

        <label className="inspector-field">
          <span>{inf.titleField}</span>
          <GuardedInput
            value={infoData.title ?? ''}
            placeholder={inf.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_INFO_TEXT_CHARS_REGEX}
            formatError={safeguard.infoTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...infoData, title: val || undefined })
            }
          />
        </label>

        <label className="inspector-field">
          <span>{inf.accTitleField}</span>
          <GuardedInput
            value={infoData.accTitle ?? ''}
            placeholder={inf.accTitlePlaceholder}
            forbiddenRegex={FORBIDDEN_INFO_TEXT_CHARS_REGEX}
            formatError={safeguard.infoTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...infoData, accTitle: val || undefined })
            }
          />
        </label>

        <label className="inspector-field">
          <span>{inf.accDescrField}</span>
          <GuardedInput
            value={infoData.accDescr ?? ''}
            placeholder={inf.accDescrPlaceholder}
            forbiddenRegex={FORBIDDEN_INFO_TEXT_CHARS_REGEX}
            formatError={safeguard.infoTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...infoData, accDescr: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={inf.commentsSection}
        fieldLabel={inf.commentsField}
        placeholder={inf.commentsPlaceholder}
        comments={infoData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...infoData, comments })}
      />
    </div>
  );
}
