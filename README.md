# Joint Bank Account

A multi-signature Ethereum smart contract for joint bank accounts with an approval-based withdrawal system. Built with Solidity 0.8.x and Hardhat.

## Overview

This project implements a joint bank account where multiple owners share control over a single account balance. Withdrawals follow a multi-signature approval flow: any owner can request a withdrawal, but all other owners must approve it before funds can be released. This prevents any single owner from unilaterally draining the account.

### Key Constraints

- **Max 4 owners** per account (minimum 1 — a personal account)
- **Max 3 accounts** per user across the entire contract
- **No duplicate owners** within a single account
- Withdrawals require **approval from all non-requesting owners**
- Only the **original requester** can execute an approved withdrawal

---

## Architecture

### Smart Contract (`contracts/BankAccount.sol`)

The contract manages two core data structures:

```
Account
├── owners: address[]          — List of account owners
├── balance: uint256           — Total ETH deposited
└── withdrawRequests: mapping  — Withdrawal requests by ID

WithdrawRequest
├── user: address              — Who requested the withdrawal
├── amount: uint256            — Amount to withdraw
├── approvals: uint256         — Number of approvals received
├── ownersApproved: mapping    — Tracks which owners approved
└── approved: bool             — Becomes true when all approvals are met
```

Global state:
- `accounts` — Mapping of account ID to Account struct
- `userAccounts` — Mapping of user address to list of account IDs they belong to
- `nextAccountId` / `nextWithdrawId` — Auto-incrementing ID counters

### Contract Functions

| Function | Access | Description |
|---|---|---|
| `createAccount(address[] otherOwners)` | Anyone | Creates a new joint account. Caller + `otherOwners` become owners |
| `deposit(uint256 accountId)` | Account owner only | Deposits ETH into the account |
| `requestWithdrawl(uint256 accountId, uint256 amount)` | Account owner only | Creates a withdrawal request. Requires sufficient balance |
| `approveWithdrawl(uint256 accountId, uint256 withdrawId)` | Account owner only | Approves a pending request. Rejected if: already approved, you created it, it doesn't exist, or you already voted |
| `withdraw(uint256 accountId, uint256 withdrawId)` | Request creator only | Executes the withdrawal after all approvals are met |
| `getAccounts()` | Anyone | Returns account IDs for the caller |
| `getBalance(uint256 accountId)` | Anyone | Returns the ETH balance of an account |
| `getOwners(uint256 accountId)` | Anyone | Returns the owners of an account |
| `getApprovals(uint256 accountId, uint256 withdrawId)` | Anyone | Returns the current approval count for a request |

### Modifiers

| Modifier | Purpose |
|---|---|
| `accountOwner` | Checks `msg.sender` is in the account's owner list |
| `validOwners` | Ensures no duplicate owners and max 4 total |
| `sufficientBalance` | Ensures account balance covers the withdrawal amount |
| `canApprove` | Validates approval conditions (not already approved, not self-approving, request exists, not double-voting) |
| `canWithdraw` | Ensures only the request creator can withdraw and the request is fully approved |

### Events

| Event | Emitted When |
|---|---|
| `AccountCreated(owners, id, timestamp)` | A new account is created |
| `Deposit(user, accountId, value, timestamp)` | ETH is deposited |
| `WithdrawRequested(user, accountId, withdrawId, amount, timestamp)` | A withdrawal is requested |
| `Withdraw(withdrawId, timestamp)` | A withdrawal is executed |

### Approval Logic

The approval threshold is `owners.length - 1` (all owners except the requester). Once the last required approval is cast, the request is marked `approved = true` and the requester can call `withdraw()`.

---

## Test Coverage

22 tests across 5 test groups, located in `test/BankAccount.js`:

### Deployment
- Contract deploys without error

### Creating an Account
- Single, double, triple, and quad owner accounts
- Rejects duplicate owners
- Rejects more than 4 owners
- Rejects creating more than 3 accounts per user

### Depositing
- Account owner can deposit
- Non-owner cannot deposit

### Withdrawal Flow
#### Request
- Owner can request withdrawal with sufficient balance
- Owner cannot request more than the balance
- Non-owner cannot request

#### Approve
- Owner can approve another owner's request
- Non-owner cannot approve
- Cannot approve twice
- Cannot approve your own request

#### Execute
- Requester can withdraw after all approvals
- Cannot withdraw twice (request is deleted)
- Non-requester cannot withdraw
- Cannot withdraw an unapproved request

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16+
- [MetaMask](https://metamask.io/) browser extension (for frontend)

### Installation

```bash
git clone <repo-url>
cd Joint-Bank-Account
npm install
```

### Compile

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

All 22 tests should pass.

### Deploy Locally

Terminal 1 — Start the Hardhat network:

```bash
npx hardhat node
```

Terminal 2 — Deploy the contract:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

This writes the deployed contract address and ABI to `deployment.json`. The frontend reads this address from the hardcoded value in `frontend/script.js` — update it if you redeploy.

### Run the Frontend

```bash
node server.js
```

Opens at `http://localhost:8080`.

### MetaMask Setup

1. Add a custom network:
   - **RPC URL**: `http://localhost:8545`
   - **Chain ID**: `31337`
   - **Currency Symbol**: `ETH`
2. Import Hardhat test accounts using mnemonic: `test test test test test test test test test test test junk`
3. The first account (index 0) has the deployed contract — use it to create accounts, deposit, etc.

---

## Project Structure

```
Joint-Bank-Account/
├── contracts/
│   └── BankAccount.sol      — Solidity smart contract source
├── test/
│   └── BankAccount.js       — Hardhat test suite (22 tests)
├── scripts/
│   └── deploy.js            — Deployment script
├── frontend/
│   ├── base.html            — Frontend HTML page
│   └── script.js            — Frontend JS (ethers.js + MetaMask)
├── deployment.json          — Deployed contract address and ABI
├── hardhat.config.js        — Hardhat configuration (solc 0.8.17)
├── package.json             — Node.js dependencies
├── server.js                — Static file server for frontend
└── README.md                — This file
```

---

## Security Considerations

- **Re-entrancy**: The `withdraw` function uses the checks-effects-interactions pattern — balance is deducted before the external call, and the withdrawal request is deleted in the same step.
- **Approval integrity**: Each owner can only approve once per request, enforced by the `ownersApproved` mapping. Self-approval is blocked.
- **Balance checks**: Both `requestWithdrawl` and `withdraw` check the account balance to prevent over-withdrawal.
- **Ownership verification**: All sensitive operations are guarded by the `accountOwner` modifier which iterates the owner list to verify `msg.sender`.
