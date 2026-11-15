
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const NAVIGATION = [
  "Dashboard",
  "Deposits",
  "Expenses",
  "Meal Count",
  "Settlement",
  "Members",
  "History",
  "Settings",
];

const todayBD = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const currentMonthBD = () => todayBD().slice(0, 7);
const monthLabel = (value) => {
  if (!value) return "All months";
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const money = (value) =>
  `৳ ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

function App({ group, user, onLogout, onLeaveMess }) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryType, setEntryType] = useState("Deposit");
  const [editingEntryId, setEditingEntryId] = useState(null);

  const [dbMembers, setDbMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");

  const [editingMember, setEditingMember] = useState(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Invite code state
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  // Mess name and admin transfer
  const [messName, setMessName] = useState(group?.name || "");
  const [savingMessName, setSavingMessName] = useState(false);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState("");
  const [transferringAdmin, setTransferringAdmin] = useState(false);

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [entriesError, setEntriesError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthBD());
  const [mealSettings, setMealSettings] = useState({ breakfast: false, lunch: true, dinner: true });
  const [mealSettingsLoading, setMealSettingsLoading] = useState(false);
  const [savingMealSettings, setSavingMealSettings] = useState(false);

  const [formData, setFormData] = useState({
    memberId: "",
    amount: "",
    category: "",
    quantity: "",
    date: todayBD(),
    note: "",
  });

  // Load actual members from Supabase
  const loadMembers = async () => {
    if (!group?.id) return;

    setMembersLoading(true);
    setMembersError("");

    const { data, error } = await supabase.rpc("get_mess_members", {
      p_group_id: group.id,
    });

    if (error) {
      console.error("Member loading error:", error);
      setMembersError(error.message);
    } else {
      setDbMembers(data || []);
    }

    setMembersLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, [group?.id]);

  const loadMealSettings = async () => {
    if (!group?.id) return;
    setMealSettingsLoading(true);
    const { data, error } = await supabase
      .from("group_meal_settings")
      .select("breakfast, lunch, dinner")
      .eq("group_id", group.id)
      .maybeSingle();
    if (error) {
      console.error("Meal settings load error:", error);
    } else if (data) {
      setMealSettings({
        breakfast: !!data.breakfast,
        lunch: !!data.lunch,
        dinner: !!data.dinner,
      });
    }
    setMealSettingsLoading(false);
  };

  useEffect(() => {
    loadMealSettings();
  }, [group?.id]);

  const saveMealSettings = async () => {
    if (group?.role !== "admin") return;
    if (!mealSettings.breakfast && !mealSettings.lunch && !mealSettings.dinner) {
      alert("Select at least one meal.");
      return;
    }
    setSavingMealSettings(true);
    const { error } = await supabase.from("group_meal_settings").upsert({
      group_id: group.id,
      breakfast: mealSettings.breakfast,
      lunch: mealSettings.lunch,
      dinner: mealSettings.dinner,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "group_id" });
    if (error) {
      alert("Could not save meal settings: " + error.message);
    } else {
      alert("Daily meal settings saved. Automatic entries run daily at 10:00 PM Bangladesh time.");
    }
    setSavingMealSettings(false);
  };

  // Load entries belonging only to the active mess.
  const loadEntries = async () => {
    if (!group?.id) return;
    setEntriesLoading(true);
    setEntriesError("");

    const { data, error } = await supabase
      .from("entries")
      .select("id, group_id, member_id, entry_type, title, amount, quantity, entry_date, note, created_by, updated_by")
      .eq("group_id", group.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Entry loading error:", error);
      setEntriesError(error.message);
      setEntries([]);
    } else {
      const memberMap = new Map(dbMembers.map((m) => [m.membership_id, m.display_name]));
      setEntries((data || []).map((row) => ({
        id: row.id,
        memberId: row.member_id,
        member: memberMap.get(row.member_id) || "—",
        type: row.entry_type.charAt(0).toUpperCase() + row.entry_type.slice(1),
        amount: Number(row.amount || 0),
        category: row.title || "",
        quantity: Number(row.quantity || 0),
        date: row.entry_date,
        note: row.note || "",
      })));
    }
    setEntriesLoading(false);
  };

  useEffect(() => {
    if (group?.id) loadEntries();
  }, [group?.id, dbMembers]);

  // Save member name to Supabase
  const handleSaveMemberName = async () => {
    const name = newMemberName.trim();

    if (name.length < 2 || name.length > 40) {
      alert("Name must be between 2 and 40 characters.");
      return;
    }

    setSavingName(true);

    const { error } = await supabase.rpc("update_mess_member_name", {
      p_membership_id: editingMember.membership_id,
      p_display_name: name,
    });

    if (error) {
      alert("Could not update name: " + error.message);
      console.error(error);
    } else {
      alert("Member name updated successfully!");
      setEditingMember(null);
      setNewMemberName("");
      await loadMembers();
    }

    setSavingName(false);
  };

  const openEditName = (member) => {
    setEditingMember(member);
    setNewMemberName(member.display_name || "");
  };

  // Generate an invite code for this mess (admin only)
  const handleGenerateInviteCode = async () => {
    if (group?.role !== "admin") return;

    const confirmed = window.confirm(
      "Generate a new invite code? Any previously generated code will stop working."
    );

    if (!confirmed) return;

    setInviteLoading(true);
    setInviteError("");
    setCopyMessage("");
    setInviteCode("");

    const { data, error } = await supabase.rpc("create_invite_code", {
      p_group_id: group.id,
    });

    if (error) {
      console.error("Invite code generation error:", error);
      setInviteError(error.message || "Could not generate invite code.");
    } else {
      setInviteCode(data);
    }

    setInviteLoading(false);
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyMessage("Invite code copied!");
    } catch (error) {
      console.error("Copy invite code error:", error);
      setCopyMessage(
        "Could not copy automatically. Please select and copy the code."
      );
    }
  };

  const handleSaveMessName = async () => {
    const name = messName.trim();

    if (name.length < 2 || name.length > 60) {
      alert("Mess name must be between 2 and 60 characters.");
      return;
    }

    setSavingMessName(true);
    const { error } = await supabase.rpc("update_mess_group_name", {
      p_group_id: group.id,
      p_name: name,
    });

    if (error) {
      console.error("Mess name update error:", error);
      alert("Could not update mess name: " + error.message);
    } else {
      alert("Mess name updated successfully!");
      window.location.reload();
    }
    setSavingMessName(false);
  };

  const handleTransferAdmin = async () => {
    if (!selectedNewAdmin) {
      alert("Please select a member first.");
      return;
    }

    const target = dbMembers.find(
      (member) => member.membership_id === selectedNewAdmin
    );
    const confirmed = window.confirm(
      `Transfer admin role to ${target?.display_name || "this member"}? You will become a regular member.`
    );
    if (!confirmed) return;

    setTransferringAdmin(true);
    const { error } = await supabase.rpc("transfer_mess_admin", {
      p_group_id: group.id,
      p_new_admin_membership_id: selectedNewAdmin,
    });

    if (error) {
      console.error("Admin transfer error:", error);
      alert("Could not transfer admin role: " + error.message);
      setTransferringAdmin(false);
    } else {
      alert("Admin role transferred successfully.");
      window.location.reload();
    }
  };

  // Month-filtered view: all calculations follow the selected entry month.
  const availableMonths = [...new Set(entries.map((entry) => (entry.date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const monthEntries = entries.filter((entry) => !selectedMonth || (entry.date || "").slice(0, 7) === selectedMonth);

  // All totals are calculated from the active mess's database entries.
  const addedDeposits = monthEntries
    .filter((entry) => entry.type === "Deposit")
    .reduce((total, entry) => total + entry.amount, 0);
  const addedExpenses = monthEntries
    .filter((entry) => entry.type === "Expense")
    .reduce((total, entry) => total + entry.amount, 0);
  const addedMeals = monthEntries
    .filter((entry) => entry.type === "Meal")
    .reduce((total, entry) => total + entry.quantity, 0);

  const totalDeposit = addedDeposits;
  const totalExpenses = addedExpenses;
  const totalMeals = addedMeals;
  const mealFund = totalDeposit - totalExpenses;
  const mealRate = totalMeals > 0 ? totalExpenses / totalMeals : 0;

  const members = useMemo(
    () => dbMembers.map((dbMember) => {
      const memberEntries = monthEntries.filter(
        (entry) => entry.memberId === dbMember.membership_id
      );
      const deposit = memberEntries
        .filter((entry) => entry.type === "Deposit")
        .reduce((total, entry) => total + entry.amount, 0);
      const meals = memberEntries
        .filter((entry) => entry.type === "Meal")
        .reduce((total, entry) => total + entry.quantity, 0);
      return {
        name: dbMember.display_name,
        membershipId: dbMember.membership_id,
        meals,
        deposit,
        balance: deposit - meals * mealRate,
      };
    }),
    [dbMembers, monthEntries, mealRate]
  );

  // Build a simple settlement plan: debtors pay members with positive balances.
  const settlement = useMemo(() => {
    const creditors = members
      .filter((member) => member.balance > 0.005)
      .map((member) => ({ name: member.name, remaining: Math.round(member.balance * 100) / 100 }));
    const debtors = members
      .filter((member) => member.balance < -0.005)
      .map((member) => ({ name: member.name, remaining: Math.round(Math.abs(member.balance) * 100) / 100 }));

    const payments = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const amount = Math.round(
        Math.min(creditors[creditorIndex].remaining, debtors[debtorIndex].remaining) * 100
      ) / 100;

      if (amount > 0) {
        payments.push({
          from: debtors[debtorIndex].name,
          to: creditors[creditorIndex].name,
          amount,
        });
      }

      creditors[creditorIndex].remaining = Math.round((creditors[creditorIndex].remaining - amount) * 100) / 100;
      debtors[debtorIndex].remaining = Math.round((debtors[debtorIndex].remaining - amount) * 100) / 100;

      if (creditors[creditorIndex].remaining <= 0.005) creditorIndex++;
      if (debtors[debtorIndex].remaining <= 0.005) debtorIndex++;
    }

    return payments;
  }, [members]);

  const stats = [
    { title: "Total Deposit", amount: money(totalDeposit), icon: "↗" },
    { title: "Total Expenses", amount: money(totalExpenses), icon: "↘" },
    { title: "Total Meals", amount: totalMeals, icon: "🍽" },
    { title: "Meal Rate", amount: money(mealRate), icon: "৳" },
    { title: "Meal Fund", amount: money(mealFund), icon: "💰" },
  ];

  const pageEntries = monthEntries.filter((entry) => {
    if (activePage === "Deposits") return entry.type === "Deposit";
    if (activePage === "Expenses") return entry.type === "Expense";
    if (activePage === "Meal Count") return entry.type === "Meal";
    return true;
  });

  const resetForm = () => {
    setFormData({
      memberId: dbMembers[0]?.membership_id || "",
      amount: "",
      category: "",
      quantity: "",
      date: todayBD(),
      note: "",
    });
  };

  const openEntryModal = (type = "Deposit") => {
    if (group?.role !== "admin") {
      alert("Only the mess admin can add entries.");
      return;
    }
    setEntryType(type);
    setEditingEntryId(null);
    resetForm();
    setShowEntryModal(true);
  };

  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEntryType(entry.type);
    setFormData({
      memberId: entry.memberId || "",
      amount: entry.amount ?? "",
      category: entry.category || "",
      quantity: entry.quantity ?? "",
      date: entry.date || todayBD(),
      note: entry.note || "",
    });
    setShowEntryModal(true);
  };

  const closeEntryModal = () => {
    setShowEntryModal(false);
    setEditingEntryId(null);
    resetForm();
  };

  const handleSaveEntry = async () => {
    if (group?.role !== "admin") {
      alert("Only the mess admin can add or edit entries.");
      return;
    }
    if (!formData.date) return alert("Please select a date.");
    if ((entryType === "Deposit" || entryType === "Expense") && (!formData.amount || Number(formData.amount) <= 0)) {
      return alert("Please enter a valid amount.");
    }
    if (entryType === "Expense" && !formData.category.trim()) {
      return alert("Please enter an expense category.");
    }
    if (entryType === "Meal" && (formData.quantity === "" || Number(formData.quantity) <= 0)) {
      return alert("Please enter a valid meal quantity.");
    }
    if ((entryType === "Deposit" || entryType === "Meal") && !formData.memberId) {
      return alert("Please select a member.");
    }

    const payload = {
      group_id: group.id,
      member_id: entryType === "Expense" ? null : formData.memberId,
      entry_type: entryType.toLowerCase(),
      title: entryType === "Expense" ? formData.category.trim() : entryType,
      amount: entryType === "Meal" ? 0 : Number(formData.amount),
      quantity: entryType === "Meal" ? Number(formData.quantity) : null,
      entry_date: formData.date,
      note: formData.note.trim() || null,
      updated_by: user.id,
    };

    setSavingEntry(true);
    let result;
    if (editingEntryId) {
      result = await supabase.from("entries").update(payload).eq("id", editingEntryId).eq("group_id", group.id);
    } else {
      result = await supabase.from("entries").insert({ ...payload, created_by: user.id });
    }
    if (result.error) {
      console.error("Entry save error:", result.error);
      alert("Could not save entry: " + result.error.message);
    } else {
      closeEntryModal();
      await loadEntries();
    }
    setSavingEntry(false);
  };

  const deleteEntry = async (id) => {
    if (group?.role !== "admin") return alert("Only the mess admin can delete entries.");
    if (!window.confirm("Delete this entry?")) return;
    const { error } = await supabase.from("entries").delete().eq("id", id).eq("group_id", group.id);
    if (error) {
      console.error("Entry delete error:", error);
      alert("Could not delete entry: " + error.message);
    } else {
      await loadEntries();
    }
  };

  const renderEntriesTable = (items) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm text-left">
        <thead className="text-gray-500 border-b border-white/10">
          <tr>
            <th className="py-4 pr-4">Type</th>
            <th className="pr-4">Member</th>
            <th className="pr-4">Date</th>
            <th className="pr-4">Details</th>
            <th className="pr-4">Amount / Meals</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="6" className="py-8 text-center text-gray-500">
                No entries found yet.
              </td>
            </tr>
          ) : (
            items.map((entry) => (
              <tr key={entry.id} className="border-b border-white/5">
                <td className="py-4 pr-4">
                  <span
                    className={`rounded-lg px-2 py-1 text-xs ${
                      entry.type === "Deposit"
                        ? "bg-emerald-400/10 text-emerald-400"
                        : entry.type === "Expense"
                        ? "bg-red-400/10 text-red-400"
                        : "bg-sky-400/10 text-sky-400"
                    }`}
                  >
                    {entry.type}
                  </span>
                </td>
                <td className="pr-4">{entry.member}</td>
                <td className="pr-4 text-gray-400">
                  <div>{entry.date}</div>
                  <div className="text-xs text-gray-600">{monthLabel((entry.date || "").slice(0, 7))}</div>
                </td>
                <td className="pr-4 text-gray-400">
                  {entry.category || entry.note || "—"}
                </td>
                <td className="pr-4">
                  {entry.type === "Meal"
                    ? `${entry.quantity} meals`
                    : money(entry.amount)}
                </td>
                <td className="text-right">
                  {group?.role === "admin" && <div className="flex justify-end gap-3">
                    <button
                      onClick={() => handleEditEntry(entry)}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#101312] text-white flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/10 p-6">
        <h1 className="text-2xl font-bold mb-10">
          Mess<span className="text-emerald-400">Manager.</span>
        </h1>

        <p className="text-xs text-gray-500 uppercase mb-4">Menu</p>

        <nav className="space-y-2">
          {NAVIGATION.map((item) => (
            <button
              key={item}
              onClick={() => setActivePage(item)}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${
                activePage === item
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="mt-auto border border-white/10 rounded-xl p-4">
          <p className="text-sm font-medium">
            {group?.role === "admin" ? "Mess Admin" : "Mess Member"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {group?.name || "Your Mess"}
          </p>
          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-3 text-sm text-red-400 hover:text-red-300"
            >
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 md:p-8 min-w-0">
        <header className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <p className="text-gray-500 text-sm">Welcome back</p>
            <h2 className="text-2xl md:text-3xl font-semibold mt-1">
              {activePage}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-400">
              Month
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="ml-2 rounded-xl border border-white/10 bg-[#191e1b] px-3 py-3 text-white"
              >
                <option value="">All months</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>{monthLabel(month)}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => openEntryModal()}
              className="bg-emerald-400 text-black px-5 py-3 rounded-xl font-semibold hover:bg-emerald-300"
            >
              + Add Entry
            </button>
          </div>
        </header>

        {entriesError && (
          <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">
            Could not load entries: {entriesError}
            <button onClick={loadEntries} className="ml-3 underline">Retry</button>
          </div>
        )}
        {entriesLoading && (
          <p className="mb-4 text-sm text-gray-500">Loading mess entries...</p>
        )}

        {/* Dashboard */}
        {activePage === "Dashboard" && (
          <>
            <section className="mb-8">
              <p className="text-gray-400 text-sm">Your Group</p>
              <h3 className="text-xl font-semibold mt-1">
                {group?.name || "Bachelor Mess"}
              </h3>
              <p className="text-gray-500 text-sm mt-1">{selectedMonth ? monthLabel(selectedMonth) : "All months"} overview</p>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 mb-10">
              {stats.map((stat) => (
                <div
                  key={stat.title}
                  className={`bg-[#191e1b] border rounded-2xl p-5 ${
                    stat.title === "Meal Fund"
                      ? "border-emerald-400/30"
                      : "border-white/10"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-sm">{stat.title}</p>
                    <span className="text-emerald-400">{stat.icon}</span>
                  </div>
                  <h3 className="text-2xl font-semibold mt-4">
                    {stat.amount}
                  </h3>
                  {stat.title === "Meal Fund" && (
                    <p className="text-xs text-gray-500 mt-2">
                      Deposit − Expenses
                    </p>
                  )}
                </div>
              ))}
            </section>

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-5 mb-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Members Overview</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Monthly member summary
                  </p>
                </div>
                <button
                  onClick={() => setActivePage("Members")}
                  className="text-emerald-400 text-sm"
                >
                  View all →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[600px]">
                  <thead className="text-gray-500 border-b border-white/10">
                    <tr>
                      <th className="py-4">Member</th>
                      <th>Meals</th>
                      <th>Deposit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.name} className="border-b border-white/5">
                        <td className="py-4 font-medium">{member.name}</td>
                        <td className="text-gray-400">{member.meals}</td>
                        <td className="text-gray-400">
                          {money(member.deposit)}
                        </td>
                        <td
                          className={
                            member.balance >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {money(Math.abs(member.balance))}
                          {member.balance < 0 ? " Due" : " Remaining"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-lg font-semibold">Entry History</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Recently added deposits, expenses and meals
                  </p>
                </div>
                <button
                  onClick={() => setActivePage("History")}
                  className="text-emerald-400 text-sm"
                >
                  View all →
                </button>
              </div>
              {renderEntriesTable(monthEntries.slice(0, 5))}
            </section>
          </>
        )}

        {/* Entry Pages */}
        {["Deposits", "Expenses", "Meal Count", "History"].includes(
          activePage
        ) && (
          <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-5">
            <div className="flex flex-wrap justify-between gap-3 items-center mb-5">
              <div>
                <h3 className="text-lg font-semibold">
                  {activePage === "History" ? "All Entries" : activePage}
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  {pageEntries.length} saved{" "}
                  {pageEntries.length === 1 ? "entry" : "entries"}
                </p>
              </div>
              {activePage !== "History" && (
                <button
                  onClick={() =>
                    openEntryModal(
                      activePage === "Meal Count"
                        ? "Meal"
                        : activePage.slice(0, -1)
                    )
                  }
                  className="text-emerald-400 text-sm"
                >
                  + Add{" "}
                  {activePage === "Meal Count"
                    ? "Meal"
                    : activePage.slice(0, -1)}
                </button>
              )}
            </div>
            {renderEntriesTable(pageEntries)}
          </section>
        )}

        {/* Settlement Page */}
        {activePage === "Settlement" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#191e1b] border border-white/10 rounded-2xl p-5">
                <p className="text-sm text-gray-400">Total Expense</p>
                <h3 className="text-2xl font-semibold mt-3">{money(totalExpenses)}</h3>
              </div>
              <div className="bg-[#191e1b] border border-white/10 rounded-2xl p-5">
                <p className="text-sm text-gray-400">Total Meals</p>
                <h3 className="text-2xl font-semibold mt-3">{totalMeals}</h3>
              </div>
              <div className="bg-[#191e1b] border border-emerald-400/30 rounded-2xl p-5">
                <p className="text-sm text-gray-400">Meal Rate</p>
                <h3 className="text-2xl font-semibold text-emerald-400 mt-3">{money(mealRate)}</h3>
              </div>
            </section>

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-5">
              <div className="mb-5">
                <h3 className="text-lg font-semibold">Member Settlement</h3>
                <p className="text-gray-500 text-sm mt-1">Deposit minus individual meal cost</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm text-left">
                  <thead className="text-gray-500 border-b border-white/10">
                    <tr>
                      <th className="py-4 pr-4">Member</th>
                      <th className="pr-4">Meals</th>
                      <th className="pr-4">Deposit</th>
                      <th className="pr-4">Meal Cost</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const cost = member.meals * mealRate;
                      return (
                        <tr key={member.name} className="border-b border-white/5">
                          <td className="py-4 pr-4 font-medium">{member.name}</td>
                          <td className="pr-4 text-gray-400">{member.meals}</td>
                          <td className="pr-4 text-gray-400">{money(member.deposit)}</td>
                          <td className="pr-4 text-gray-400">{money(cost)}</td>
                          <td className={`text-right font-medium ${member.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {member.balance > 0.005 ? `${money(member.balance)} Receive` : member.balance < -0.005 ? `${money(Math.abs(member.balance))} Pay` : "Settled"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-5">
              <div className="mb-5">
                <h3 className="text-lg font-semibold">Who Pays Whom</h3>
                <p className="text-gray-500 text-sm mt-1">Suggested payments to settle everyone’s meal contribution</p>
              </div>
              {settlement.length === 0 ? (
                <p className="py-6 text-center text-emerald-400">Everyone is settled. No payment is needed.</p>
              ) : (
                <div className="space-y-3">
                  {settlement.map((payment, index) => (
                    <div key={`${payment.from}-${payment.to}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#101312] p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-red-400 font-medium">{payment.from}</span>
                        <span className="text-gray-500">pays</span>
                        <span className="text-emerald-400 font-medium">{payment.to}</span>
                      </div>
                      <span className="text-lg font-semibold">{money(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <p className="text-xs text-gray-500">Settlement is calculated from this mess’s Supabase entries for the selected month.</p>
          </div>
        )}

        {/* Members Page */}
        {activePage === "Members" && (
          <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-5">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
              <div>
                <h3 className="text-lg font-semibold">All Members</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Manage member names in your mess
                </p>
              </div>
              <button
                onClick={loadMembers}
                className="text-emerald-400 text-sm"
              >
                ↻ Refresh Members
              </button>
            </div>

            {membersLoading ? (
              <p className="py-8 text-center text-gray-400">
                Loading members...
              </p>
            ) : membersError ? (
              <div className="py-6 text-center">
                <p className="text-red-400 text-sm">{membersError}</p>
                <button
                  onClick={loadMembers}
                  className="mt-3 text-emerald-400 text-sm"
                >
                  Try Again
                </button>
              </div>
            ) : dbMembers.length === 0 ? (
              <p className="py-8 text-center text-gray-400">
                No members found.
              </p>
            ) : (
              <div className="space-y-3">
                {dbMembers.map((member) => {
                  const canEdit =
                    member.user_id === user?.id ||
                    group?.role === "admin";

                  return (
                    <div
                      key={member.membership_id}
                      className="flex flex-wrap justify-between items-center gap-3 border border-white/10 rounded-xl p-4"
                    >
                      <div>
                        <p className="font-medium">{member.display_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {member.role === "admin" ? "Admin" : "Member"}
                          {member.user_id === user?.id ? " · You" : ""}
                        </p>
                      </div>

                      {canEdit && (
                        <button
                          onClick={() => openEditName(member)}
                          className="rounded-lg border border-emerald-400/30 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-400/10"
                        >
                          Edit Name
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Group Chat */}
        {activePage === "Group Chat" && (
          <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold">Group Chat</h3>
            <p className="text-gray-400 text-sm mt-2">
              Group chat will be connected after backend setup.
            </p>
          </section>
        )}

        {/* Settings */}
        {activePage === "Settings" && (
          <div className="space-y-5">
            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold">Mess Settings</h3>
              <p className="text-gray-400 text-sm mt-2">
                Mess:{" "}
                <span className="text-white">
                  {group?.name || "Your Mess"}
                </span>
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Your role:{" "}
                <span className="text-white">
                  {group?.role === "admin" ? "Admin" : "Member"}
                </span>
              </p>

              {group?.role === "admin" && (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <label className="block text-sm text-gray-400">
                    Change Mess Name
                    <input
                      type="text"
                      value={messName}
                      maxLength={60}
                      onChange={(e) => setMessName(e.target.value)}
                      className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                      placeholder="Enter mess name"
                    />
                  </label>
                  <button
                    onClick={handleSaveMessName}
                    disabled={savingMessName || messName.trim() === (group?.name || "")}
                    className="mt-3 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
                  >
                    {savingMessName ? "Saving..." : "Save Mess Name"}
                  </button>
                </div>
              )}
            </section>

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold">Automatic Daily Meals</h3>
              <p className="text-gray-400 text-sm mt-2">
                Selected meal sessions are added for every active member automatically at 10:00 PM Bangladesh time.
              </p>
              {group?.role === "admin" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                    {[
                      ["breakfast", "Breakfast"],
                      ["lunch", "Lunch"],
                      ["dinner", "Dinner"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 rounded-xl border border-white/10 p-4 text-sm">
                        <input
                          type="checkbox"
                          checked={mealSettings[key]}
                          disabled={mealSettingsLoading}
                          onChange={(e) => setMealSettings((current) => ({ ...current, [key]: e.target.checked }))}
                          className="h-4 w-4 accent-emerald-400"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={saveMealSettings}
                    disabled={savingMealSettings || mealSettingsLoading}
                    className="mt-4 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {savingMealSettings ? "Saving..." : "Save Daily Meal Settings"}
                  </button>
                </>
              ) : (
                <p className="mt-4 text-sm text-gray-500">Only the mess admin can change automatic meal settings.</p>
              )}
              <p className="mt-3 text-xs text-gray-500">
                One automatic meal entry per member per date. If the scheduler is unavailable, no entry is created until it runs successfully.
              </p>
            </section>

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold">Invite Members</h3>
              <p className="text-gray-400 text-sm mt-2">
                Generate an invite code and share it with people you want to
                add to this mess.
              </p>

              {group?.role === "admin" ? (
                <>
                  <button
                    onClick={handleGenerateInviteCode}
                    disabled={inviteLoading}
                    className="mt-5 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {inviteLoading
                      ? "Generating..."
                      : inviteCode
                      ? "Generate New Code"
                      : "Generate Invite Code"}
                  </button>

                  {inviteCode && (
                    <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-400">
                        Your Invite Code
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <code className="text-2xl font-bold tracking-[0.2em] text-emerald-400">
                          {inviteCode}
                        </code>
                        <button
                          onClick={handleCopyInviteCode}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        >
                          Copy Code
                        </button>
                      </div>
                      {copyMessage && (
                        <p className="mt-2 text-xs text-gray-300">
                          {copyMessage}
                        </p>
                      )}
                    </div>
                  )}

                  {inviteError && (
                    <p className="mt-4 text-sm text-red-400">
                      {inviteError}
                    </p>
                  )}

                  <p className="mt-4 text-xs text-amber-300/80">
                    Warning: Generating a new code will invalidate the
                    previous invite code.
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-gray-500">
                  Only the mess admin can generate an invite code. Ask your
                  admin to share one with you.
                </p>
              )}
            </section>

            {group?.role === "admin" && (
              <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold">Transfer Admin</h3>
                <p className="text-gray-400 text-sm mt-2">
                  Transfer admin control to another active member. You will become a regular member.
                </p>

                {membersLoading ? (
                  <p className="mt-4 text-sm text-gray-500">Loading members...</p>
                ) : (
                  <>
                    <select
                      value={selectedNewAdmin}
                      onChange={(e) => setSelectedNewAdmin(e.target.value)}
                      className="w-full mt-4 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                    >
                      <option value="">Select a member</option>
                      {dbMembers
                        .filter((member) => member.role !== "admin")
                        .map((member) => (
                          <option key={member.membership_id} value={member.membership_id}>
                            {member.display_name || "Member"}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleTransferAdmin}
                      disabled={!selectedNewAdmin || transferringAdmin}
                      className="mt-3 rounded-xl border border-amber-400/30 px-4 py-3 text-sm text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"
                    >
                      {transferringAdmin ? "Transferring..." : "Transfer Admin Role"}
                    </button>
                    {dbMembers.filter((member) => member.role !== "admin").length === 0 && (
                      <p className="mt-3 text-xs text-amber-300/80">
                        No other active member is available to receive admin access.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold">Leave Mess</h3>
              <p className="text-gray-400 text-sm mt-2">
                Leave this mess and join another one using an invite code. Your previous mess history will be retained.
              </p>
              {group?.role === "admin" && dbMembers.filter((member) => member.role === "admin").length <= 1 && (
                <p className="mt-3 text-xs text-amber-300/80">
                  As the only admin, transfer the admin role to another member before leaving.
                </p>
              )}
              <button
                onClick={onLeaveMess}
                className="mt-5 rounded-xl border border-red-400/30 px-4 py-3 text-sm text-red-400 hover:bg-red-400/10"
              >
                Leave This Mess
              </button>
            </section>

            <section className="bg-[#191e1b] border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold">Local Demo Data</h3>
              <p className="text-gray-400 text-sm mt-2">
                This clears only the demo entries saved in this browser.
              </p>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear all entries saved in this browser? This cannot be undone."
                    )
                  ) {
                    setEntries([]);
                  }
                }}
                className="mt-5 rounded-xl border border-red-400/30 px-4 py-3 text-sm text-red-400 hover:bg-red-400/10"
              >
                Clear saved demo entries
              </button>
            </section>
          </div>
        )}

        <footer className="text-center text-gray-600 text-xs mt-10">
          MessManager © 2026 · Manage your mess smarter.
        </footer>
      </main>

      {/* Edit Member Name Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#191e1b] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Edit Member Name</h2>
              <button
                onClick={() => setEditingMember(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <label className="block text-sm text-gray-400">
              Member Name
              <input
                type="text"
                value={newMemberName}
                maxLength={40}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Enter member name"
                className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
              />
            </label>

            <p className="text-xs text-gray-500 mt-2">
              Name must contain 2–40 characters.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingMember(null)}
                disabled={savingName}
                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMemberName}
                disabled={savingName}
                className="flex-1 py-3 rounded-xl bg-emerald-400 text-black font-semibold disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#191e1b] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">
                {editingEntryId !== null ? "Edit Entry" : "Quick Add Entry"}
              </h2>
              <button
                onClick={closeEntryModal}
                className="text-gray-400 hover:text-white text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {["Deposit", "Expense", "Meal"].map((type) => (
                <button
                  key={type}
                  onClick={() => setEntryType(type)}
                  disabled={editingEntryId !== null}
                  className={`py-3 rounded-xl text-sm font-medium disabled:opacity-50 ${
                    entryType === type
                      ? "bg-emerald-400 text-black"
                      : "bg-white/5 text-gray-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {(entryType === "Deposit" || entryType === "Meal") && (
                <label className="block text-sm text-gray-400">
                  Select Member
                  <select
                    value={formData.memberId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        memberId: e.target.value,
                      })
                    }
                    className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                  >
                    {dbMembers.map((member) => (
                      <option key={member.membership_id} value={member.membership_id}>
                        {member.display_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {entryType === "Expense" && (
                <label className="block text-sm text-gray-400">
                  Expense Category
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value,
                      })
                    }
                    placeholder="e.g. Bazar, Gas, Rent"
                    className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                  />
                </label>
              )}

              {entryType === "Meal" ? (
                <label className="block text-sm text-gray-400">
                  Meal Quantity
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity: e.target.value,
                      })
                    }
                    placeholder="Enter meal quantity"
                    className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                  />
                </label>
              ) : (
                <label className="block text-sm text-gray-400">
                  Amount (৳)
                  <input
                    type="number"
                    min="1"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        amount: e.target.value,
                      })
                    }
                    placeholder="Enter amount"
                    className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                  />
                </label>
              )}

              <label className="block text-sm text-gray-400">
                Date
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      date: e.target.value,
                    })
                  }
                  className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                />
              </label>

              <label className="block text-sm text-gray-400">
                Note (Optional)
                <textarea
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      note: e.target.value,
                    })
                  }
                  placeholder="Write a note..."
                  rows="3"
                  className="w-full mt-2 bg-[#101312] border border-white/10 rounded-xl p-3 text-white"
                />
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEntryModal}
                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEntry}
                disabled={savingEntry}
                className="flex-1 py-3 rounded-xl bg-emerald-400 text-black font-semibold hover:bg-emerald-300 disabled:opacity-50"
              >
                {savingEntry ? "Saving..." : editingEntryId !== null ? "Update Entry" : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
