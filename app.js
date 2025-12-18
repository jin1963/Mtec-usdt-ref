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
    el.style.borderColor = isError ? "#ff5a5a" : "rgba(255,255,255,.12)";
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
        refLink.value = "";
        setMsg("กระเป๋าถูกตัดการเชื่อมต่อ");
        return;
      }
      wallet = ethers.utils.getAddress(accs[0]);
      walletText.textContent = `wallet: ${shortAddr(wallet)}`;
      refLink.value = buildRefLink(wallet);
      setMsg("เปลี่ยนบัญชีแล้ว ✅");
      await refreshAllowanceUI().catch(() => {});
    });

    window.ethereum.on("chainChanged", async () => {
      // รีโหลดเพื่อความเสถียรกับ wallet หลายค่าย
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

    // Request accounts
    const accs = await provider.send("eth_requestAccounts", []);
    wallet = ethers.utils.getAddress(accs[0]);
    signer = provider.getSigner();

    // Check chain
    const net = await provider.getNetwork();
    chainId = Number(net.chainId);
    chainText.textContent = `chainId: ${chainId}`;
    walletText.textContent = `wallet: ${shortAddr(wallet)}`;

    // Show contract address
    contractText.textContent = window.ADDR.CONTRACT;

    // Switch to BSC if needed
    if (chainId !== window.NETWORK.chainId) {
      setMsg("กำลังสลับไป BSC (0x38) ...");
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: window.NETWORK.chainIdHex }]
        });
      } catch (e) {
        // If chain not added
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

      // refresh network after switch
      const net2 = await provider.getNetwork();
      chainId = Number(net2.chainId);
      chainText.textContent = `chainId: ${chainId}`;
      if (chainId !== window.NETWORK.chainId) {
        setMsg("กรุณาอยู่บน BNB Smart Chain ก่อนใช้งาน", true);
        return;
      }
    }

    // Init contracts
    contract = new ethers.Contract(window.ADDR.CONTRACT, window.CONTRACT_ABI, signer);
    usdt = new ethers.Contract(window.ADDR.USDT, window.ERC20_ABI, signer);

    // Referral link
    refLink.value = buildRefLink(wallet);

    // Load packages into select
    await loadPackages();

    // Update allowance UI
    await refreshAllowanceUI();

    setMsg("เชื่อมต่อสำเร็จ ✅");
  }

  // -----------------------
  // Packages
  // -----------------------
  async function loadPackages() {
    if (!contract) return;

    setMsg("กำลังโหลดแพ็คเกจ...");
    packageSelect.innerHTML = "";
    packagesCache = [];

    const count = await contract.packageCount();
    const n = Number(count.toString());

    if (n === 0) {
      const opt = document.createElement("option");
      opt.value = "0";
      opt.textContent = "ไม่มีแพ็คเกจ";
      packageSelect.appendChild(opt);
      packageSelect.disabled = true;
      btnBuy.disabled = true;
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

      packageSelect.appendChild(opt);
    }

    // select first active
    const firstActive = packagesCache.find((x) => x.active);
    selectedPkgId = firstActive ? firstActive.id : 0;
    packageSelect.value = String(selectedPkgId);

    packageSelect.disabled = false;
    btnBuy.disabled = false;

    setMsg("");
  }

  function getSelectedPackage() {
    const id = Number(packageSelect.value || "0");
    const p = packagesCache.find((x) => x.id === id);
    return p || null;
  }

  // -----------------------
  // Allowance / Approve
  // -----------------------
  async function refreshAllowanceUI() {
    if (!wallet || !usdt) return;

    const p = getSelectedPackage();
    if (!p) return;

    const allowance = await usdt.allowance(wallet, window.ADDR.CONTRACT);

    // If allowance >= required -> optional approve
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
      // Approve Max for convenience
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

    // Determine ref
    const refFromUrl = getRefFromUrl();
    let ref = refFromUrl;

    // Prevent self-ref
    if (ref !== ZERO && wallet && ref.toLowerCase() === wallet.toLowerCase()) {
      ref = ZERO;
    }

    // Check allowance
    const allowance = await usdt.allowance(wallet, window.ADDR.CONTRACT);
    if (allowance.lt(p.usdtIn)) {
      setMsg("Allowance USDT ไม่พอ → กด Approve ก่อนครับ", true);
      return;
    }

    setBtnLoading(btnBuy, true, "Buying...");
    try {
      const tx = await contract.buyPackage(p.id, ref);
      await waitTx(tx, "Buy & Auto-Stake");
      // หลังซื้อสำเร็จ อาจอยากรีเฟรช allowance ก็ได้
      await refreshAllowanceUI();
    } catch (e) {
      console.error(e);
      setMsg(e?.data?.message || e?.message || "ซื้อแพ็คเกจไม่สำเร็จ", true);
    } finally {
      setBtnLoading(btnBuy, false);
    }
  }

  // -----------------------
  // Copy referral link
  // -----------------------
  async function copyReferralLink() {
    try {
      const text = refLink.value || "";
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setMsg("คัดลอกลิงก์ Referral แล้ว ✅");
    } catch {
      // fallback
      refLink.select();
      document.execCommand("copy");
      setMsg("คัดลอกลิงก์ Referral แล้ว ✅");
    }
  }

  // -----------------------
  // Bind UI
  // -----------------------
  function bindUI() {
    contractText.textContent = window.ADDR?.CONTRACT || "-";

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
  }

  // -----------------------
  // Boot
  // -----------------------
  function boot() {
    bindUI();
    bindWalletEvents();

    // show initial ref (without wallet) from URL if present
    const ref = getRefFromUrl();
    if (ref !== ZERO) {
      setMsg(`พบ ref ในลิงก์: ${shortAddr(ref)} (จะใช้ตอนกดซื้อ)`);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
