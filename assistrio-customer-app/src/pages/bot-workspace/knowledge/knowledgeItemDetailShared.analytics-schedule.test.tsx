import { describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { KnowledgeItemTrainingAnalytics } from './knowledgeItemDetailShared';

describe('KnowledgeItemTrainingAnalytics — training status vs embedded schedule', () => {
  it('shows Training Queued and countdown beside Training status heading when queued with runAfter', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    flushSync(() =>
      root.render(
        <KnowledgeItemTrainingAnalytics
          status="queued"
          kbLifecyclePresentation={{ label: 'Training Queued', dotCanon: 'queued' }}
          trainingLifecycleRaw="queued"
          trainingScheduleRunAfter="2099-01-01T00:00:00.000Z"
        />,
      ),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Training Queued');
    expect(text).not.toContain('Not used in replies');
    expect(text).not.toContain('Used in replies');
    expect(text).not.toContain('Training schedule');
    root.unmount();
    container.remove();
  });

  it('shows Trained in Training status when ready', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    flushSync(() =>
      root.render(
        <KnowledgeItemTrainingAnalytics
          status="ready"
          kbLifecyclePresentation={{ label: 'Trained', dotCanon: 'ready' }}
          trainingLifecycleRaw="ready"
        />,
      ),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Trained');
    expect(text).not.toContain('Used in replies');
    expect(text).not.toContain('Training schedule');
    root.unmount();
    container.remove();
  });

  it('does not embed countdown when lifecycle is pending even with runAfter', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    flushSync(() =>
      root.render(
        <KnowledgeItemTrainingAnalytics
          status="pending"
          kbLifecyclePresentation={{ label: 'Training Required', dotCanon: 'pending' }}
          trainingLifecycleRaw="pending"
          trainingScheduleRunAfter="2099-01-01T00:00:00.000Z"
        />,
      ),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Training Required');
    expect(text).not.toContain('Training schedule');
    root.unmount();
    container.remove();
  });

  it('does not embed countdown when lifecycle is processing even with runAfter', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    flushSync(() =>
      root.render(
        <KnowledgeItemTrainingAnalytics
          status="processing"
          kbLifecyclePresentation={{ label: 'Training', dotCanon: 'processing' }}
          trainingLifecycleRaw="processing"
          trainingScheduleRunAfter="2099-01-01T00:00:00.000Z"
        />,
      ),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Training');
    expect(text).not.toContain('Training schedule');
    root.unmount();
    container.remove();
  });
});
