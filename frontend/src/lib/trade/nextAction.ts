export type UserRole = 'buyer' | 'seller' | 'mediator' | 'observer';

export type TradeStatus =
  | 'CREATED'
  | 'FUNDED'
  | 'MANIFEST_PENDING'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'DISPUTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | string;

export interface NextActionDescriptor {
  /** The party responsible for the next action. */
  responsibleParty: UserRole;
  /** Human-readable description of the next required action. */
  message: string;
  /** Whether the connected wallet must act now. */
  actionRequired: boolean;
}

export interface ResolveNextActionParams {
  /** Connected wallet address (may be undefined when not connected). */
  walletAddress?: string | null;
  /** Trade buyer address. */
  buyerAddress?: string | null;
  /** Trade seller address. */
  sellerAddress?: string | null;
  /** Mediator allowlist (addresses). */
  mediatorAllowlist?: string[] | null;
  /** Current trade status. */
  status?: TradeStatus | null;
}

function normalize(address?: string | null): string | null {
  if (!address) return null;
  return address.trim().toLowerCase();
}

/**
 * Resolves the viewer's role relative to a trade.
 */
export function resolveUserRole({
  walletAddress,
  buyerAddress,
  sellerAddress,
  mediatorAllowlist,
}: Pick<
  ResolveNextActionParams,
  'walletAddress' | 'buyerAddress' | 'sellerAddress' | 'mediatorAllowlist'
>): UserRole {
  const wallet = normalize(walletAddress);
  if (!wallet) return 'observer';

  const buyer = normalize(buyerAddress);
  const seller = normalize(sellerAddress);

  if (buyer && wallet === buyer) return 'buyer';
  if (seller && wallet === seller) return 'seller';

  const allowlist = (mediatorAllowlist ?? [])
    .map((addr) => normalize(addr))
    .filter((addr): addr is string => Boolean(addr));

  if (allowlist.includes(wallet)) return 'mediator';

  return 'observer';
}

interface StatusAction {
  responsibleParty: UserRole;
  /** Message templates keyed by role; fallback used when role not present. */
  messages: Partial<Record<UserRole, string>> & { default: string };
}

const STATUS_ACTIONS: Record<string, StatusAction> = {
  CREATED: {
    responsibleParty: 'buyer',
    messages: {
      buyer: 'Action Required: Fund the escrow to start the trade',
      seller: 'Waiting for Buyer to fund the escrow',
      mediator: 'Waiting for Buyer to fund the escrow',
      default: 'Waiting for Buyer to fund the escrow',
    },
  },
  FUNDED: {
    responsibleParty: 'seller',
    messages: {
      buyer: 'Waiting for Seller to submit Driver Manifest',
      seller: 'Action Required: Submit Driver Manifest',
      mediator: 'Waiting for Seller to submit Driver Manifest',
      default: 'Waiting for Seller to submit Driver Manifest',
    },
  },
  MANIFEST_PENDING: {
    responsibleParty: 'seller',
    messages: {
      buyer: 'Waiting for Seller to submit Driver Manifest',
      seller: 'Action Required: Submit Driver Manifest',
      mediator: 'Waiting for Seller to submit Driver Manifest',
      default: 'Waiting for Seller to submit Driver Manifest',
    },
  },
  IN_TRANSIT: {
    responsibleParty: 'buyer',
    messages: {
      buyer: 'Action Required: Upload Proof-of-Delivery video once received',
      seller: 'Waiting for Buyer to confirm delivery',
      mediator: 'Waiting for Buyer to confirm delivery',
      default: 'Waiting for Buyer to confirm delivery',
    },
  },
  DELIVERED: {
    responsibleParty: 'buyer',
    messages: {
      buyer: 'Action Required: Review delivery and release funds',
      seller: 'Waiting for Buyer to release funds',
      mediator: 'Waiting for Buyer to release funds',
      default: 'Waiting for Buyer to release funds',
    },
  },
  DISPUTED: {
    responsibleParty: 'mediator',
    messages: {
      buyer: 'Waiting for Mediator to resolve the dispute',
      seller: 'Waiting for Mediator to resolve the dispute',
      mediator: 'Action Required: Review and resolve the dispute',
      default: 'Waiting for Mediator to resolve the dispute',
    },
  },
  COMPLETED: {
    responsibleParty: 'observer',
    messages: {
      buyer: 'Trade complete — no further action required',
      seller: 'Trade complete — no further action required',
      mediator: 'Trade complete — no further action required',
      default: 'Trade complete — no further action required',
    },
  },
  CANCELLED: {
    responsibleParty: 'observer',
    messages: {
      buyer: 'Trade cancelled — no further action required',
      seller: 'Trade cancelled — no further action required',
      mediator: 'Trade cancelled — no further action required',
      default: 'Trade cancelled — no further action required',
    },
  },
  REFUNDED: {
    responsibleParty: 'observer',
    messages: {
      buyer: 'Trade refunded — no further action required',
      seller: 'Trade refunded — no further action required',
      mediator: 'Trade refunded — no further action required',
      default: 'Trade refunded — no further action required',
    },
  },
};

/**
 * Resolves the next required action for the connected wallet given the trade status.
 */
export function resolveNextAction(
  params: ResolveNextActionParams,
): NextActionDescriptor {
  const role = resolveUserRole(params);
  const status = (params.status ?? '').toString().toUpperCase();

  const action = STATUS_ACTIONS[status];

  if (!action) {
    return {
      responsibleParty: 'observer',
      message: 'Awaiting trade status update',
      actionRequired: false,
    };
  }

  const message = action.messages[role] ?? action.messages.default;
  const actionRequired =
    role !== 'observer' && role === action.responsibleParty;

  return {
    responsibleParty: action.responsibleParty,
    message,
    actionRequired,
  };
}