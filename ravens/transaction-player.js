(function transactionPlayerModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RavensTransactionPlayer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTransactionPlayerApi() {
  const ACTION_PATTERN = /^(?:Activated|Acquired|Claimed|Elevated|Placed|Promoted|Re-signed|Released|Signed|Suspended|Traded|Waived)\s+/i;
  const POSITION_PATTERN = /^(?:(?:QB|RB|FB|WR|TE|T|OT|G|C|OL|DL|DE|DT|NT|LB|ILB|OLB|CB|DB|S|K|P|LS)(?:\/(?:QB|RB|FB|WR|TE|T|OT|G|C|OL|DL|DE|DT|NT|LB|ILB|OLB|CB|DB|S|K|P|LS))?\s+)/i;
  const NAME_END_PATTERN = /\s+(?:to|from|on|off|onto|after|following|with|via|in exchange for)\b|\s*\(|[,;]|$/i;
  const KNOWN_ESPN_IDS = {
    "shedrick jackson": "4361332",
  };

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.’']/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
  }

  function displayName(player) {
    return player?.displayName || player?.fullName || "";
  }

  function identityName(value) {
    return normalizeName(value).replace(/\s+(?:jr|sr|ii|iii|iv)$/, "");
  }

  function extractName(description) {
    let remainder = String(description || "").trim().replace(ACTION_PATTERN, "").replace(POSITION_PATTERN, "");
    if (!remainder || remainder === String(description || "").trim()) return "";
    const end = remainder.search(NAME_END_PATTERN);
    if (end >= 0) remainder = remainder.slice(0, end);
    return remainder.replace(/[.\s]+$/, "").trim();
  }

  function resolve(description, roster = []) {
    const extractedName = extractName(description);
    const normalizedExtracted = normalizeName(extractedName);
    if (normalizedExtracted) {
      const exact = roster.find((player) => normalizeName(displayName(player)) === normalizedExtracted || identityName(displayName(player)) === identityName(extractedName));
      if (exact) return exact;
      return {
        displayName: extractedName,
        ...(KNOWN_ESPN_IDS[normalizedExtracted] ? { id: KNOWN_ESPN_IDS[normalizedExtracted] } : {}),
      };
    }

    const text = normalizeName(description);
    const fullNameMatches = roster.filter((player) => {
      const name = normalizeName(displayName(player));
      return name && text.includes(name);
    });
    if (fullNameMatches.length === 1) return fullNameMatches[0];

    const surnameMatches = roster.filter((player) => {
      const name = normalizeName(displayName(player));
      const surname = normalizeName(player?.lastName || name.split(" ").at(-1));
      return surname.length >= 5 && text.split(" ").includes(surname);
    });
    return surnameMatches.length === 1 ? surnameMatches[0] : null;
  }

  return { extractName, normalizeName, resolve };
});
