// app.js — MTEC Auto-Stake (Bitget + MetaMask) | ethers v5
(() => {
  "use strict";

  // -----------------------
  // Helpers
  // -----------------------
  const $ = (id) => document.getElementById(id);
  const ZERO = "0x0000000000000000000000000000000000000000";

  function shortAddr(a) {
    if (!a) return "-";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function fmtUnits(bn, dec = 18, digits = 6) {
    try {
      const s = ethers.utils.formatUnits(bn || 0, dec);
      // ตัดทศนิยมให้สั้น อ่านง่าย
      const [i, f] = s.split(".");
      if (!f) return i;
      return `${i}.${f.slice(0, digits).replace(/0+$/, "")}`.replace(/\.$/, "");
    } catch {
      return "0";
    }
  }

  function getRefFromUrl() {
    try {
      const u = new URL(window.location.href);
      const ref = u.searchParams.get("ref");
      if (!ref) return ZERO;
      if (!ethers.utils.isAddress(ref)) return ZERO;
      return ethers.utils.getAddress(ref);
    } catch (e) {
      return ZERO;
    }
  }

  function buildRefLink(wallet) {
    const u = new URL(window.location.href);
    u.searchParams.set("ref", wallet);
    return u.toString();
  }

  function setMsg(text, isError = false) {
    const el = $("txMessage");
    if (!el) return;
    el.textContent = text || "";
    el.style.opacity = text ? "1" : "0";
    el.style.borderColor = isError ? "#ff5a5a" : "rgba(10, 60, 120, .12)";
  }

  function setBtnLoading(btn, loading, textWhenLoading = "Processing...") {
    if (!btn) return;
    if (loading) {
      btn.dataset._old = btn.textContent;
      btn.textContent = textWhenLoading;
      btn.disabled = true;
      btn.style.opacity = "0.7";
    } else {
      btn.textContent = btn.dataset._old || btn.textContent;
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  }

  async function waitTx(tx, label = "Transaction") {
    setMsg(`${label}: ส่งแล้ว รอ Confirm...`);
    const r = await tx.wait();
    setMsg(`${label}: สำเร็จ ✅ (block ${r.blockNumber})`);
    return r;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  // -----------------------
  // State
  // -----------------------
  let provider = null;
  let signer = null;
  let wallet = null;
  let chainId = null;

  let contract = null;
  let usdt = null;

  let packagesCache = []; // [{id, usdtIn, mtecOut, active}]
  let selectedPkgId = 0;

  // -----------------------
  // UI Elements
  // -----------------------
  const btnConnect = $("btnConnect");
  const chainText = $("chainText");
  const walletText = $("walletText");
  const contractText = $("contractText");

  const packageSelect = $("packageSelect");
  const btnApprove = $("btnApprove");
  const btnBuy = $("btnBuy");

  const refLink = $("refLink");
  const btnCopy = $("btnCopy");

  const stakeList = $("stakeList");
  const stakeCountText = $("stakeCountText");
  const totalPrincipalText = $("totalPrincipalText");
  const totalPendingText = $("totalPendingText");
  const btnRefreshStake = $("btnRefreshStake");
  const btnClaimAll = $("btnClaimAll");

  // -----------------------
  // Init
  // -----------------------
  function ensureConfig() {
    if (!window.NETWORK || !window.ADDR || !window.CONTRACT_ABI || !window.ERC20_ABI) {
      throw new Error("Missing config.js globals (NETWORK/ADDR/ABI).");
    }
  }

  function bindWalletEvents() {
    if (!window.ethereum) return;

    window.ethereum.on("accountsChanged", async (accs) => {
      if (!accs || accs.length === 0) {
        wallet = null;
        walletText.textContent = "wallet: -";
        if (refLink) refLink.value = "";
        setMsg("กระเป๋าถูกตัดการเชื่อมต่อ");
        if (stakeList) stakeList.innerHTML = "-";
        return;
      }
      wallet = ethers.utils.getAddress(accs[0]);
      walletText.textContent = `wallet: ${shortAddr(wallet)}`;
      if (refLink) refLink.value = buildRefLink(wallet);
      setMsg("เปลี่ยนบัญชีแล้ว ✅");
      await refreshAllowanceUI().catch(() => {});
      await loadMyStakes().catch(() => {});
    });

    window.ethereum.on("chainChanged", async () => {
      window.location.reload();
    });
  }

  async function connectWallet() {
    ensureConfig();

    if (!window.ethereum) {
      setMsg("ไม่พบ Wallet (MetaMask/Bitget) ในเบราว์เซอร์นี้", true);
      return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum, "any");

    const accs = await provider.send("eth_requestAccounts", []);
    wallet = ethers.utils.getAddress(accs[0]);
    signer = provider.getSigner();

    const net = await provider.getNetwork();
    chainId = Number(net.chainId);
    if (chainText) chainText.textContent = `chainId: ${chainId}`;
    if (walletText) walletText.textContent = `wallet: ${shortAddr(wallet)}`;

    if (contractText) contractText.textContent = window.ADDR.CONTRACT;

    if (chainId !== window.NETWORK.chainId) {
      setMsg("กำลังสลับไป BSC (0x38) ...");
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: window.NETWORK.chainIdHex }]
        });
      } catch (e) {
        if (e && (e.code === 4902 || String(e.message || "").includes("Unrecognized chain"))) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: window.NETWORK.chainIdHex,
              chainName: window.NETWORK.chainName,
              rpcUrls: window.NETWORK.rpcUrls,
              nativeCurrency: window.NETWORK.nativeCurrency,
              blockExplorerUrls: window.NETWORK.blockExplorerUrls
            }]
          });
        } else {
          setMsg("สลับเครือข่ายไม่สำเร็จ กรุณาเปลี่ยนเป็น BSC ด้วยตนเอง", true);
          return;
        }
      }

      const net2 = await provider.getNetwork();
      chainId = Number(net2.chainId);
      if (chainText) chainText.textContent = `chainId: ${chainId}`;
      if (chainId !== window.NETWORK.chainId) {
        setMsg("กรุณาอยู่บน BNB Smart Chain ก่อนใช้งาน", true);
        return;
      }
    }

    contract = new ethers.Contract(window.ADDR.CONTRACT, window.CONTRACT_ABI, signer);
    usdt = new ethers.Contract(window.ADDR.USDT, window.ERC20_ABI, signer);

    if (refLink) refLink.value = buildRefLink(wallet);

    await loadPackages();
    await refreshAllowanceUI();
    await loadMyStakes();

    setMsg("เชื่อมต่อสำเร็จ ✅");
  }

  // -----------------------
  // Packages
  // -----------------------
  async function loadPackages() {
    if (!contract) return;

    setMsg("กำลังโหลดแพ็คเกจ...");
    if (packageSelect) packageSelect.innerHTML = "";
    packagesCache = [];

    const count = await contract.packageCount();
    const n = Number(count.toString());

    if (n === 0) {
      if (packageSelect) {
        const opt = document.createElement("option");
        opt.value = "0";
        opt.textContent = "ไม่มีแพ็คเกจ";
        packageSelect.appendChild(opt);
        packageSelect.disabled = true;
      }
      if (btnBuy) btnBuy.disabled = true;
      setMsg("ไม่พบแพ็คเกจในสัญญา", true);
      return;
    }

    for (let i = 0; i < n; i++) {
      const p = await contract.packages(i);
      const usdtIn = p.usdtIn;
      const mtecOut = p.mtecOut;
      const active = p.active;

      const usdtHuman = ethers.utils.formatUnits(usdtIn, window.DECIMALS.USDT);
      const mtecHuman = ethers.utils.formatUnits(mtecOut, window.DECIMALS.MTEC);

      packagesCache.push({ id: i, usdtIn, mtecOut, active });

      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `แพ็คเกจ #${i} — จ่าย ${usdtHuman} USDT → ได้ ${mtecHuman} MTEC ${active ? "" : "(ปิดใช้งาน)"}`;
      opt.disabled = !active;

      if (packageSelect) packageSelect.appendChild(opt);
    }

    const firstActive = packagesCache.find((x) => x.active);
    selectedPkgId = firstActive ? firstActive.id : 0;
    if (packageSelect) {
      packageSelect.value = String(selectedPkgId);
      packageSelect.disabled = false;
    }
    if (btnBuy) btnBuy.disabled = false;

    setMsg("");
  }

  function getSelectedPackage() {
    const id = Number((packageSelect?.value) || "0");
    const p = packagesCache.find((x) => x.id === id);
    return p || null;
  }

  // -----------------------
  // Allowance / Approve
  // -----------------------
  async function refreshAllowanceUI() {
    if (!wallet || !usdt || !btnApprove) return;

    const p = getSelectedPackage();
    if (!p) return;

    const allowance = await usdt.allowance(wallet, window.ADDR.CONTRACT);

    if (allowance.gte(p.usdtIn)) {
      btnApprove.textContent = "USDT Approved ✅";
      btnApprove.disabled = true;
      btnApprove.style.opacity = "0.7";
    } else {
      btnApprove.textContent = "Approve USDT (Optional)";
      btnApprove.disabled = false;
      btnApprove.style.opacity = "1";
    }
  }

  async function approveUSDT() {
    if (!usdt) {
      setMsg("กรุณา Connect Wallet ก่อน", true);
      return;
    }

    const p = getSelectedPackage();
    if (!p) return;

    setBtnLoading(btnApprove, true, "Approving...");
    try {
      const tx = await usdt.approve(window.ADDR.CONTRACT, ethers.constants.MaxUint256);
      await waitTx(tx, "Approve");
      await refreshAllowanceUI();
    } catch (e) {
      console.error(e);
      setMsg(e?.data?.message || e?.message || "Approve ไม่สำเร็จ", true);
    } finally {
      setBtnLoading(btnApprove, false);
    }
  }

  // -----------------------
  // Buy & Auto-Stake
  // -----------------------
  async function buyAndStake() {
    if (!contract || !wallet) {
      setMsg("กรุณา Connect Wallet ก่อน", true);
      return;
    }

    const p = getSelectedPackage();
    if (!p) return;

    if (!p.active) {
      setMsg("แพ็คเกจนี้ปิดใช้งานอยู่", true);
      return;
    }

    let ref = getRefFromUrl();
    if (ref !== ZERO && wallet && ref.toLowerCase() === wallet.toLowerCase()) {
      ref = ZERO;
    }

    const allowance = await usdt.allowance(wallet, window.ADDR.CONTRACT);
    if (allowance.lt(p.usdtIn)) {
      setMsg("Allowance USDT ไม่พอ → กด Approve ก่อนครับ", true);
      return;
    }

    setBtnLoading(btnBuy, true, "Buying...");
    try {
      const tx = await contract.buyPackage(p.id, ref);
      await waitTx(tx, "Buy & Auto-Stake");
      await refreshAllowanceUI();
      await loadMyStakes(); // รีเฟรชยอด stake หลังซื้อ
    } catch (e) {
      console.error(e);
      setMsg(e?.data?.message || e?.message || "ซื้อแพ็คเกจไม่สำเร็จ", true);
    } finally {
      setBtnLoading(btnBuy, false);
    }
  }

  // -----------------------
  // Stake UI + Claim
  // -----------------------
  async function loadMyStakes() {
    if (!contract || !wallet) return;
    if (!stakeList) return;

    stakeList.innerHTML = "กำลังโหลด...";
    if (stakeCountText) stakeCountText.textContent = "stakes: ...";
    if (totalPrincipalText) totalPrincipalText.textContent = "total principal: ...";
    if (totalPendingText) totalPendingText.textContent = "total pending: ...";

    const countBN = await contract.getStakeCount(wallet);
    const n = Number(countBN.toString());

    if (stakeCountText) stakeCountText.textContent = `stakes: ${n}`;

    if (n === 0) {
      stakeList.innerHTML = "<div class='small' style='justify-content:flex-start;'>ยังไม่มีการ Stake</div>";
      if (totalPrincipalText) totalPrincipalText.textContent = "total principal: 0";
      if (totalPendingText) totalPendingText.textContent = "total pending: 0";
      if (btnClaimAll) btnClaimAll.disabled = true;
      return;
    }

    let totalPrincipal = ethers.BigNumber.from(0);
    let totalPending = ethers.BigNumber.from(0);

    // render newest first
    let cards = "";
    for (let i = n - 1; i >= 0; i--) {
      const s = await contract.getStake(wallet, i);
      const pending = await contract.pendingReward(wallet, i);
      const can = await contract.canClaim(wallet, i);

      totalPrincipal = totalPrincipal.add(s.principalMTEC);
      totalPending = totalPending.add(pending);

      const start = new Date(Number(s.startTime.toString()) * 1000);
      const lockSec = Number(s.lockAtStake.toString());
      const unlock = new Date(start.getTime() + lockSec * 1000);

      const principalTxt = fmtUnits(s.principalMTEC, window.DECIMALS.MTEC);
      const pendingTxt = fmtUnits(pending, window.DECIMALS.MTEC);
      const apyBP = Number(s.apyBPAtStake.toString());
      const apyPct = (apyBP / 100).toFixed(2); // basis points → %
      const claimed = !!s.claimed;

      cards += `
        <div style="margin-bottom:12px;padding:12px;border:1px solid rgba(10,60,120,.12);border-radius:14px;background:#fbfdff;">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="font-weight:800;">Stake #${esc(i + 1)}</div>
            <div style="color:rgba(11,27,43,.65);font-size:13px;">index: ${esc(i)}</div>
          </div>

          <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><b>Principal</b><br/>${esc(principalTxt)} MTEC</div>
            <div><b>Pending</b><br/>${esc(pendingTxt)} MTEC</div>
            <div><b>APY</b><br/>${esc(apyPct)}%</div>
            <div><b>Status</b><br/>${claimed ? "Claimed" : "Active"}</div>
            <div style="grid-column:1 / -1;">
              <b>Start</b> ${esc(start.toLocaleString())}<br/>
              <b>Unlock</b> ${esc(unlock.toLocaleString())}
            </div>
          </div>

          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn" data-claim="${esc(i)}" ${can ? "" : "disabled"} style="flex:1 1 180px;">
              ${can ? "Claim" : "ยังเคลมไม่ได้"}
            </button>
          </div>
        </div>
      `;
    }

    stakeList.innerHTML = cards;

    if (totalPrincipalText) totalPrincipalText.textContent = `total principal: ${fmtUnits(totalPrincipal, window.DECIMALS.MTEC)} MTEC`;
    if (totalPendingText) totalPendingText.textContent = `total pending: ${fmtUnits(totalPending, window.DECIMALS.MTEC)} MTEC`;

    // claim all enabled if any canClaim
    let anyCan = false;
    for (let i = 0; i < n; i++) {
      const can = await contract.canClaim(wallet, i);
      if (can) { anyCan = true; break; }
    }
    if (btnClaimAll) btnClaimAll.disabled = !anyCan;

    // bind claim buttons
    stakeList.querySelectorAll("button[data-claim]").forEach((b) => {
      b.addEventListener("click", async () => {
        const idx = Number(b.getAttribute("data-claim"));
        await claimOne(idx, b);
      });
    });
  }

  async function claimOne(index, buttonEl) {
    if (!contract || !wallet) {
      setMsg("กรุณา Connect Wallet ก่อน", true);
      return;
    }
    if (buttonEl) setBtnLoading(buttonEl, true, "Claiming...");
    try {
      const can = await contract.canClaim(wallet, index);
      if (!can) {
        setMsg("รายการนี้ยังเคลมไม่ได้ (ยังไม่ครบเงื่อนไข/เวลาล็อก)", true);
        return;
      }
      const tx = await contract.claim(index);
      await waitTx(tx, `Claim #${index + 1}`);
      await loadMyStakes();
    } catch (e) {
      console.error(e);
      setMsg(e?.data?.message || e?.message || "Claim ไม่สำเร็จ", true);
    } finally {
      if (buttonEl) setBtnLoading(buttonEl, false);
    }
  }

  async function claimAll() {
    if (!contract || !wallet) {
      setMsg("กรุณา Connect Wallet ก่อน", true);
      return;
    }
    if (btnClaimAll) setBtnLoading(btnClaimAll, true, "Claiming...");
    try {
      const countBN = await contract.getStakeCount(wallet);
      const n = Number(countBN.toString());
      if (n === 0) {
        setMsg("ยังไม่มีรายการ stake", true);
        return;
      }

      let claimedAny = false;
      for (let i = 0; i < n; i++) {
        const can = await contract.canClaim(wallet, i);
        if (!can) continue;

        claimedAny = true;
        const tx = await contract.claim(i);
        await waitTx(tx, `Claim #${i + 1}`);
      }

      if (!claimedAny) {
        setMsg("ยังไม่มีรายการที่เคลมได้ตอนนี้", true);
      }

      await loadMyStakes();
    } catch (e) {
      console.error(e);
      setMsg(e?.data?.message || e?.message || "Claim All ไม่สำเร็จ", true);
    } finally {
      if (btnClaimAll) setBtnLoading(btnClaimAll, false);
    }
  }

  // -----------------------
  // Copy referral link
  // -----------------------
  async function copyReferralLink() {
    try {
      const text = refLink?.value || "";
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setMsg("คัดลอกลิงก์ Referral แล้ว ✅");
    } catch {
      if (refLink) {
        refLink.select();
        document.execCommand("copy");
      }
      setMsg("คัดลอกลิงก์ Referral แล้ว ✅");
    }
  }

  // -----------------------
  // Bind UI
  // -----------------------
  function bindUI() {
    if (contractText) contractText.textContent = window.ADDR?.CONTRACT || "-";

    btnConnect?.addEventListener("click", () => {
      connectWallet().catch((e) => {
        console.error(e);
        setMsg(e?.message || "Connect ไม่สำเร็จ", true);
      });
    });

    btnApprove?.addEventListener("click", () => {
      approveUSDT().catch((e) => {
        console.error(e);
        setMsg(e?.message || "Approve error", true);
      });
    });

    btnBuy?.addEventListener("click", () => {
      buyAndStake().catch((e) => {
        console.error(e);
        setMsg(e?.message || "Buy error", true);
      });
    });

    packageSelect?.addEventListener("change", async () => {
      selectedPkgId = Number(packageSelect.value || "0");
      await refreshAllowanceUI().catch(() => {});
      setMsg("");
    });

    btnCopy?.addEventListener("click", () => {
      copyReferralLink();
    });

    btnRefreshStake?.addEventListener("click", async () => {
      await loadMyStakes().catch((e) => {
        console.error(e);
        setMsg(e?.message || "Refresh stake error", true);
      });
    });

    btnClaimAll?.addEventListener("click", async () => {
      await claimAll();
    });
  }

  // -----------------------
  // Boot
  // -----------------------
  function boot() {
    bindUI();
    bindWalletEvents();

    const ref = getRefFromUrl();
    if (ref !== ZERO) {
      setMsg(`พบ ref ในลิงก์: ${shortAddr(ref)} (จะใช้ตอนกดซื้อ)`);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
