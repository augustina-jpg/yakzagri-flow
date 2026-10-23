
import { t as translateCopy } from "@/lib/i18n";
import { BentoCard } from "@/components/ui/BentoCard";
import { SettingsIcon } from "@/components/icons";
import { Check, Clock, Flag } from "lucide-react";

type StepStatus = "completed" | "in-progress" | "pending";

interface Step {
  label: string;
  date: string;
  status: StepStatus;
  /** Specific unmet prerequisite, shown when the step is blocked. */
  blockedReason?: string;
  /** Actor role responsible for completing the step. */
  actorRole?: string;
  /** Completion timestamp, shown for completed steps. */
  completedAt?: string;
}

interface ReleaseSequenceCardProps {
  sequenceId: string;
  steps: Step[];
}

type PrerequisiteStatus = "completed" | "active" | "blocked";

interface DerivedStep extends Step {
  prerequisiteStatus: PrerequisiteStatus;
  explanation: string;
}

function deriveStep(step: Step): DerivedStep {
  if (step.status === "completed") {
    const detail = step.completedAt ?? step.actorRole;
    return {
      ...step,
      prerequisiteStatus: "completed",
      explanation: detail
        ? translateCopy("ui.release_step_completed_by_7a1f2c", {
            detail,
          })
        : translateCopy("ui.release_step_completed_3d9e4b"),
    };
  }

  if (step.status === "in-progress") {
    return {
      ...step,
      prerequisiteStatus: "active",
      explanation: step.actorRole
        ? translateCopy("ui.release_step_awaiting_actor_5c8b1d", {
            actor: step.actorRole,
          })
        : translateCopy("ui.release_step_in_progress_2f6a9e"),
    };
  }

  return {
    ...step,
    prerequisiteStatus: "blocked",
    explanation:
      step.blockedReason ??
      translateCopy("ui.release_step_blocked_generic_8b4d0f"),
  };
}

export function ReleaseSequenceCard({
  sequenceId,
  steps,
}: ReleaseSequenceCardProps) {
  const derivedSteps = steps.map(deriveStep);

  const getPrerequisiteStyles = (status: PrerequisiteStatus) => {
    switch (status) {
      case "completed":
        return "text-emerald border-emerald";
      case "active":
        return "text-gold border-gold";
      case "blocked":
        return "text-text-muted border-border-default";
    }
  };

  const getPrerequisiteLabel = (status: PrerequisiteStatus) => {
    switch (status) {
      case "completed":
        return translateCopy("ui.release_prereq_completed_1a2b3c");
      case "active":
        return translateCopy("ui.release_prereq_active_4d5e6f");
      case "blocked":
        return translateCopy("ui.release_prereq_blocked_7g8h9i");
    }
  };
  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return <Check className="w-7 h-7 text-emerald" />;
      case "in-progress":
        return <Clock className="w-7 h-7 text-gold" />;
      case "pending":
        return <Flag className="w-7 h-7 text-text-muted" />;
    }
  };

  const getStepStyles = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return "bg-emerald-muted border-emerald";
      case "in-progress":
        return "bg-gold-muted border-gold animate-pulse";
      case "pending":
        return "bg-bg-elevated border-border-default";
    }
  };

  const getTextColor = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return "text-emerald";
      case "in-progress":
        return "text-gold";
      case "pending":
        return "text-text-muted";
    }
  };

  return (
    <BentoCard
      title={translateCopy("ui.release_sequence_9bc35fc")}
      icon={<SettingsIcon className="w-5 h-5" />}
      glowVariant="gold"
      className="h-full"
    >
      <div className="flex items-center justify-end mb-6">
        <span className="text-xs font-mono text-text-secondary bg-bg-elevated px-3 py-1 rounded-full border border-border-default">
          {translateCopy("ui.sequence_id_de0476d")}{" "}{sequenceId}
        </span>
      </div>

      <div className="flex items-center justify-around">
        {derivedSteps.map((step, index) => (
          <div key={step.label} className="contents">
            <div className="flex flex-col items-center gap-3">
              <div
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${getStepStyles(step.status)}`}
                title={step.explanation}
                aria-label={`${step.label}: ${getPrerequisiteLabel(step.prerequisiteStatus)} — ${step.explanation}`}
              >
                {getStepIcon(step.status)}
              </div>
              <div className="text-center">
                <p
                  className={`text-sm font-semibold uppercase tracking-wide ${getTextColor(step.status)}`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-text-secondary">{step.date}</p>
                <span
                  className={`mt-1 inline-block text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${getPrerequisiteStyles(step.prerequisiteStatus)}`}
                  title={step.explanation}
                >
                  {getPrerequisiteLabel(step.prerequisiteStatus)}
                </span>
                <p
                  className="mt-1 text-xs text-text-secondary max-w-[10rem]"
                  title={step.explanation}
                >
                  {step.explanation}
                </p>
              </div>
            </div>

            {index < derivedSteps.length - 1 && (
              <div className="w-16 h-0.5 bg-border-default" />
            )}
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
