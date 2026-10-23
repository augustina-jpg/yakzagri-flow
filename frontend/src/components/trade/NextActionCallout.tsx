'use client';

import React from 'react';
import type { TradeStatus } from '@/types/trade';

export type TradeRole = 'buyer' | 'seller' | 'mediator' | 'observer';

export interface NextActionDescriptor {
  /** The party responsible for the next action (e.g., "Buyer", "Seller", "Mediator", "Driver"). */
  responsibleParty: string;
  /** Short description of the required action (e.g., "submit Driver Manifest"). */
  action: string;
  /** Optional longer description or hint. */
  description?: string;
}

export interface NextActionCalloutProps {
  /** Current trade status. */
  status: TradeStatus;
  /** Resolved next-action descriptor for the current status. */
  nextAction: NextActionDescriptor | null;
  /** The connected wallet's role in the trade. */
  role: TradeRole;
  /** Optional additional class names. */
  className?: string;
}

/**
 * Maps a responsible party label to the role that owns it.
 */
function partyToRole(party: string): TradeRole | null {
  const normalized = party.trim().toLowerCase();
  if (normalized === 'buyer') return 'buyer';
  if (normalized === 'seller') return 'seller';
  if (normalized === 'mediator') return 'mediator';
  return null;
}

/**
 * Presentational banner that communicates the next required action for a trade,
 * tailored to the connected wallet's role.
 */
export default function NextActionCallout({
  status,
  nextAction,
  role,
  className = '',
}: NextActionCalloutProps) {
  if (!nextAction) {
    return null;
  }

  const { responsibleParty, action, description } = nextAction;
  const responsibleRole = partyToRole(responsibleParty);
  const isActionRequired = responsibleRole !== null && responsibleRole === role;

  const baseClasses =
    'rounded-lg border p-4 mb-6 flex items-start gap-3 transition-colors';

  const variantClasses = isActionRequired
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-slate-200 bg-slate-50 text-slate-700';

  const icon = isActionRequired ? '⚠️' : '⏳';

  const heading = isActionRequired
    ? 'Action Required'
    : `Waiting for ${responsibleParty}`;

  const body = isActionRequired
    ? `${action.charAt(0).toUpperCase()}${action.slice(1)}`
    : `${responsibleParty} needs to ${action}`;

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${className}`.trim()}
      data-testid="next-action-callout"
      data-variant={isActionRequired ? 'action-required' : 'waiting'}
      data-status={status}
      data-role={role}
      role={isActionRequired ? 'alert' : 'status'}
      aria-live={isActionRequired ? 'assertive' : 'polite'}
    >
      <span className="text-xl leading-none" aria-hidden="true">
        {icon}
      </span>
      <div className="flex-1">
        <p
          className={`font-semibold ${
            isActionRequired ? 'text-amber-900' : 'text-slate-800'
          }`}
          data-testid="next-action-callout-heading"
        >
          {heading}
        </p>
        <p
          className={`mt-1 text-sm ${
            isActionRequired ? 'text-amber-800' : 'text-slate-600'
          }`}
          data-testid="next-action-callout-body"
        >
          {body}
        </p>
        {description && (
          <p
            className={`mt-1 text-xs ${
              isActionRequired ? 'text-amber-700' : 'text-slate-500'
            }`}
            data-testid="next-action-callout-description"
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}