import styles from './StepperWizard.module.css';

export interface StepItem {
  id: number;
  label: string;
}

interface StepperWizardProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
}

export default function StepperWizard({ steps, currentStep, onStepClick }: StepperWizardProps) {
  const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className={styles.wizardContainer}>
      <div className={styles.progressLine}>
        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
      </div>

      {steps.map((step) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <div
            key={step.id}
            className={`${styles.stepWrapper} ${!isCompleted && !isActive ? styles.stepWrapperDisabled : ''}`}
            onClick={() => isCompleted && onStepClick && onStepClick(step.id)}
          >
            <div
              className={`${styles.stepCircle} ${
                isCompleted ? styles.stepCompleted : isActive ? styles.stepActive : ''
              }`}
            >
              {isCompleted ? '✓' : step.id}
            </div>

            <span
              className={`${styles.stepLabel} ${
                isCompleted ? styles.stepLabelCompleted : isActive ? styles.stepLabelActive : ''
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
