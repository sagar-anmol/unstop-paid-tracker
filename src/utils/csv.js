import { isParticipantCancelled } from './paymentUtils';

export function exportParticipantsToCSV(participants) {
  if (!participants || participants.length === 0) {
    alert("No participant records available to export.");
    return false;
  }

  const headers = [
    "Sl No",
    "Registration ID",
    "Candidate Name",
    "Email",
    "Mobile",
    "College",
    "Course / Branch",
    "Graduation Year",
    "Event Name",
    "Event Category",
    "Team Name",
    "Team Size",
    "Team Members Details",
    "Amount Paid",
    "Payment Status",
    "Cancelled",
    "Cancellation Date",
    "Cancellation Reason",
    "Won Back",
    "Registration Date",
    "Resume URL"
  ];

  const escapeCSV = (field) => {
    if (field === null || field === undefined) return '""';
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = participants.map((p, index) => {
    let memberDetails = "";
    if (p.team_members && Array.isArray(p.team_members) && p.team_members.length > 0) {
      memberDetails = p.team_members
        .map((m, mIdx) => `${mIdx + 1}. ${m.name || "Member"} (${m.email || "No Email"}, ${m.phone || "No Phone"}, ${m.college || "No College"})`)
        .join(" | ");
    } else {
      memberDetails = "Solo";
    }

    return [
      index + 1,
      escapeCSV(p.id),
      escapeCSV(p.name),
      escapeCSV(p.email),
      escapeCSV(p.phone),
      escapeCSV(p.college),
      escapeCSV(p.specialization || "N/A"),
      escapeCSV(p.passing_year || "N/A"),
      escapeCSV(p.event_name),
      escapeCSV(p.event_type || "Competitions"),
      escapeCSV(p.team_name || "Individual"),
      p.team_size || 1,
      escapeCSV(memberDetails),
      p.amount !== undefined ? p.amount : 0,
      escapeCSV(p.payment_status || "UNPAID"),
      isParticipantCancelled(p) ? "YES" : "NO",
      escapeCSV(p.cancelled_at || ""),
      escapeCSV(p.cancel_reason || ""),
      isParticipantCancelled(p) && p.cancel_reverted ? "YES" : "NO",
      escapeCSV(p.registered_at || "N/A"),
      escapeCSV(p.resume_url || "")
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().substring(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `TechFEST26_Attendees_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
