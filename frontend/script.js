const provider = new ethers.providers.Web3Provider(window.ethereum);
const abi = [
  "event AccountCreated(address[] owners, uint256 indexed id, uint256 timestamp)",
  "event Deposit(address indexed user, uint256 indexed accountId, uint256 value, uint256 timestamp)",
  "event Withdraw(uint256 indexed withdrawId, uint256 timestamp)",
  "event WithdrawRequested(address indexed user, uint256 indexed accountId, uint256 indexed withdrawId, uint256 amount, uint256 timestamp)",
  "function approveWithdrawl(uint256 accountId, uint256 withdrawId)",
  "function createAccount(address[] otherOwners)",
  "function deposit(uint256 accountId) payable",
  "function getAccounts() view returns (uint256[])",
  "function getApprovals(uint256 accountId, uint256 withdrawId) view returns (uint256)",
  "function getBalance(uint256 accountId) view returns (uint256)",
  "function getOwners(uint256 accountId) view returns (address[])",
  "function requestWithdrawl(uint256 accountId, uint256 amount)",
  "function withdraw(uint256 accountId, uint256 withdrawId)",
];

const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
let contract = null;

function showError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}

function appendEvent(line) {
  const log = document.getElementById("events");
  const div = document.createElement("div");
  div.className = "event-line";
  div.textContent = line;
  log.prepend(div);
}

async function getAccess() {
  if (contract) return;
  try {
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    contract = new ethers.Contract(address, abi, signer);

    contract.on("AccountCreated", (owners, id, event) => {
      appendEvent(`AccountCreated: id=${id} owners=${owners.join(", ")}`);
      viewAccounts();
    });
    contract.on("Deposit", (user, accountId, value, event) => {
      appendEvent(`Deposit: account=${accountId} from=${user} value=${ethers.utils.formatEther(value)} ETH`);
      viewAccounts();
    });
    contract.on("WithdrawRequested", (user, accountId, withdrawId, amount, event) => {
      appendEvent(`WithdrawRequested: account=${accountId} id=${withdrawId} by=${user} amount=${ethers.utils.formatEther(amount)} ETH`);
    });
    contract.on("Withdraw", (withdrawId, event) => {
      appendEvent(`Withdraw: id=${withdrawId}`);
      viewAccounts();
    });

    setStatus("Connected");
  } catch (e) {
    showError("MetaMask connection failed: " + e.message);
    throw e;
  }
}

async function createAccount() {
  try {
    await getAccess();
    const input = document.getElementById("owners").value.trim();
    const owners = input ? input.split(",").map(s => s.trim()).filter(Boolean) : [];
    await contract.createAccount(owners);
    document.getElementById("owners").value = "";
    showError("Account created successfully");
  } catch (e) {
    showError("Create failed: " + e.message);
  }
}

async function viewAccounts() {
  try {
    await getAccess();
    const ids = await contract.getAccounts();
    const list = document.getElementById("accounts");
    if (ids.length === 0) {
      list.innerHTML = "No accounts found.";
      return;
    }
    let html = "";
    for (const id of ids) {
      const [balance, owners] = await Promise.all([
        contract.getBalance(id),
        contract.getOwners(id)
      ]);
      html += `<div class="account-item">
        <span class="account-id">#${id}</span>
        <span class="account-balance">${ethers.utils.formatEther(balance)} ETH</span>
      </div>`;
    }
    list.innerHTML = html;
  } catch (e) {
    showError("View failed: " + e.message);
  }
}

// New functions for deposit/withdraw flow
async function deposit(accountId) {
  try {
    await getAccess();
    const amount = prompt(`Enter amount to deposit (ETH):`);
    if (!amount) return;
    const tx = await contract.deposit(accountId, { value: ethers.utils.parseEther(amount) });
    await tx.wait();
    showError("Deposit successful");
  } catch (e) {
    showError("Deposit failed: " + e.message);
  }
}

async function requestWithdraw(accountId) {
  try {
    await getAccess();
    const amount = prompt(`Enter amount to withdraw (ETH):`);
    if (!amount) return;
    await contract.requestWithdrawl(accountId, ethers.utils.parseEther(amount));
    showError("Withdrawal requested");
  } catch (e) {
    showError("Request failed: " + e.message);
  }
}

async function approveWithdraw(accountId, withdrawId) {
  try {
    await getAccess();
    await contract.approveWithdrawl(accountId, withdrawId);
    showError("Approved");
  } catch (e) {
    showError("Approve failed: " + e.message);
  }
}

async function executeWithdraw(accountId, withdrawId) {
  try {
    await getAccess();
    await contract.withdraw(accountId, withdrawId);
    showError("Withdrawal executed");
  } catch (e) {
    showError("Withdraw failed: " + e.message);
  }
}