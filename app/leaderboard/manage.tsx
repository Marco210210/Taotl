import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createLeaderboard,
  addLeaderboardPlayer,
  createLeaderboardInvite,
  createProfileLinkRequest,
  fetchLeaderboardMembers,
  fetchProfileLinkRequests,
  removeLeaderboardMember,
  removeLeaderboardPlayer,
  renameLeaderboard,
  respondProfileLinkRequest,
  updateLeaderboardMember,
  type LeaderboardMemberDTO,
  type ProfileLinkRequestDTO,
} from "@/api/leaderboard";
import { fetchRoster } from "@/api/players";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinearBackButton } from "@/components/LinearBackButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ScreenIntro } from "@/components/ScreenIntro";
import type { Player } from "@/game/types";
import { useAccount } from "@/state/AccountContext";
import { useAppSettings } from "@/state/AppSettingsContext";
import { theme, type ThemeColors } from "@/theme";
import { useFocusEffect } from "expo-router";

type MemberRole = "manager" | "member" | "viewer";

export default function ManageLeaderboardScreen() {
  const params = useLocalSearchParams<{ leaderboardId?: string; name?: string; playerId?: string }>();
  const { token, account, refreshAccount } = useAccount();
  const { colors } = useAppSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [leaderboardId, setLeaderboardId] = useState(params.leaderboardId ?? "");
  const [leaderboardName, setLeaderboardName] = useState(params.name ?? "");
  const [newName, setNewName] = useState("");
  const [editedName, setEditedName] = useState(params.name ?? "");
  const [members, setMembers] = useState<LeaderboardMemberDTO[]>([]);
  const [requests, setRequests] = useState<ProfileLinkRequestDTO[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [linkHandle, setLinkHandle] = useState("");
  const [linkPlayerId, setLinkPlayerId] = useState(params.playerId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [boardPlayers, setBoardPlayers] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");

  const reload = useCallback(async () => {
    if (!token) return;
    const [nextMembers, nextRequests, boardRoster, accessibleRoster] = await Promise.all([
      leaderboardId ? fetchLeaderboardMembers(token, leaderboardId) : Promise.resolve([]),
      fetchProfileLinkRequests(token).catch(() => []),
      leaderboardId ? fetchRoster(token, leaderboardId) : Promise.resolve({ players: [], fromCache: false }),
      leaderboardId ? fetchRoster(token) : Promise.resolve({ players: [], fromCache: false }),
    ]);
    setMembers(nextMembers);
    setRequests(nextRequests.filter((request) => !leaderboardId || request.leaderboardId === leaderboardId));
    setBoardPlayers(boardRoster.players);
    const boardIds = new Set(boardRoster.players.map((player) => player.id));
    setAvailablePlayers(accessibleRoster.players.filter((player) => !boardIds.has(player.id)));
  }, [leaderboardId, token]);

  useFocusEffect(useCallback(() => { void reload().catch((error) => setMessage(error instanceof Error ? error.message : "Dati non disponibili.")); }, [reload]));

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await action(); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Operazione non riuscita."); }
    finally { setBusy(false); }
  };

  if (!token) return <ScreenContainer><ScreenIntro title="Gestione classifica" description="Accedi prima con il tuo Taotl ID." /><Button label="Accedi" onPress={() => router.replace("/account")} /></ScreenContainer>;

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <LinearBackButton destination="/leaderboard" /> }} />
      <ScreenContainer>
        <ScreenIntro title={leaderboardName || "Nuova classifica"} description="Classifica privata: solo chi riceve un invito può accedere." />

        {!leaderboardId ? (
          <Card>
            <Text style={styles.label}>Nome classifica</Text>
            <TextInput value={newName} onChangeText={setNewName} maxLength={80} placeholder="Es. Amici del venerdì" placeholderTextColor={colors.textMuted as string} style={styles.input} />
            <Button label="Crea classifica privata" loading={busy} disabled={newName.trim().length < 2} onPress={() => void run(async () => {
              const created = await createLeaderboard(token, newName.trim());
              setLeaderboardId(created.id); setLeaderboardName(created.name); await refreshAccount();
            })} />
          </Card>
        ) : (
          <>
            <Card>
              <Text style={styles.title}>Nome classifica</Text>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                maxLength={80}
                placeholder="Nome classifica"
                placeholderTextColor={colors.textMuted as string}
                style={styles.input}
              />
              <Button
                label="Salva nuovo nome"
                loading={busy}
                disabled={editedName.trim().length < 2 || editedName.trim() === leaderboardName}
                onPress={() => void run(async () => {
                  const updated = await renameLeaderboard(token, leaderboardId, editedName);
                  setLeaderboardName(updated.name);
                  setEditedName(updated.name);
                  await refreshAccount();
                })}
              />
            </Card>

            <Card>
              <Text style={styles.title}>Invita persone</Text>
              <Text style={styles.help}>Il codice scade dopo 7 giorni. Un membro può inserire partite; un osservatore può solo vedere; un gestore può anche amministrare.</Text>
              <View style={styles.roles}>
                {(["member", "viewer", "manager"] as MemberRole[]).map((role) => <Pressable key={role} onPress={() => setInviteRole(role)} style={[styles.role, inviteRole === role && styles.roleActive]}><Text style={styles.roleText}>{role === "member" ? "Membro" : role === "viewer" ? "Osservatore" : "Gestore"}</Text></Pressable>)}
              </View>
              <Button label="Genera codice invito" loading={busy} onPress={() => void run(async () => { const invite = await createLeaderboardInvite(token, leaderboardId, inviteRole); setInviteCode(invite.code); })} />
              {!!inviteCode && <Text selectable style={styles.code}>{inviteCode}</Text>}
            </Card>

            <Card>
              <Text style={styles.title}>Membri</Text>
              {members.map((member) => <View key={member.accountId} style={styles.member}>
                <View style={styles.flex}><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.help}>@{member.handle} · {member.role}</Text></View>
                {member.role !== "owner" && <>
                  <Pressable onPress={() => void run(() => updateLeaderboardMember(token, leaderboardId, member.accountId, member.role === "viewer" ? "member" : "viewer"))}><Text style={styles.action}>{member.role === "viewer" ? "Promuovi" : "Solo lettura"}</Text></Pressable>
                  <Pressable onPress={() => void run(() => removeLeaderboardMember(token, leaderboardId, member.accountId))}><Text style={styles.remove}>Rimuovi</Text></Pressable>
                </>}
              </View>)}
            </Card>

            <Card>
              <Text style={styles.title}>Giocatori della classifica</Text>
              <Text style={styles.help}>Questi sono gli unici giocatori disponibili quando si crea una partita in questa classifica.</Text>
              {boardPlayers.map((player) => <View key={player.id} style={styles.member}>
                <Text style={[styles.memberName, styles.flex]}>{player.name}</Text>
                <Pressable onPress={() => void run(() => removeLeaderboardPlayer(token, leaderboardId, player.id))}><Text style={styles.remove}>Rimuovi dalla rosa</Text></Pressable>
              </View>)}
              {boardPlayers.length === 0 && <Text style={styles.help}>La rosa è vuota.</Text>}
              <Button label="Crea un nuovo giocatore" variant="secondary" onPress={() => router.push({ pathname: "/roster/edit", params: { leaderboardId, leaderboardName, from: "manage" } })} />
            </Card>

            {availablePlayers.length > 0 && <Card>
              <Text style={styles.title}>Importa un giocatore esistente</Text>
              <TextInput value={playerSearch} onChangeText={setPlayerSearch} placeholder="Cerca per nome" placeholderTextColor={colors.textMuted as string} style={styles.input} />
              {availablePlayers
                .filter((player) => player.name.toLocaleLowerCase().includes(playerSearch.trim().toLocaleLowerCase()))
                .slice(0, 20)
                .map((player) => <View key={player.id} style={styles.member}>
                  <Text style={[styles.memberName, styles.flex]}>{player.name}</Text>
                  <Pressable onPress={() => void run(() => addLeaderboardPlayer(token, leaderboardId, player.id))}><Text style={styles.action}>Aggiungi</Text></Pressable>
                </View>)}
            </Card>}

            <Card>
              <Text style={styles.title}>Collega un profilo esistente</Text>
              <Text style={styles.help}>Inserisci Taotl ID e ID giocatore. Il collegamento avviene solo dopo l’accettazione della persona.</Text>
              <TextInput value={linkHandle} onChangeText={setLinkHandle} autoCapitalize="none" placeholder="Taotl ID" placeholderTextColor={colors.textMuted as string} style={styles.input} />
              <TextInput value={linkPlayerId} onChangeText={setLinkPlayerId} autoCapitalize="none" placeholder="ID giocatore" placeholderTextColor={colors.textMuted as string} style={styles.input} />
              <Button label="Invia richiesta" loading={busy} disabled={!linkHandle.trim() || !linkPlayerId.trim()} onPress={() => void run(async () => { await createProfileLinkRequest(token, leaderboardId, linkHandle, linkPlayerId); setLinkHandle(""); setLinkPlayerId(""); })} />
            </Card>
          </>
        )}

        {requests.length > 0 && <Card><Text style={styles.title}>Richieste di collegamento</Text>{requests.map((request) => <View key={request.id} style={styles.request}><Text style={styles.flex}>{request.playerName} → @{request.targetHandle}</Text>{request.targetAccountId === account?.id || account?.isAdmin ? <><Button label="Accetta" variant="success" onPress={() => void run(() => respondProfileLinkRequest(token, request.id, true).then(() => undefined))} /><Button label="Rifiuta" variant="ghost" onPress={() => void run(() => respondProfileLinkRequest(token, request.id, false).then(() => undefined))} /></> : <Text style={styles.help}>In attesa della persona invitata</Text>}</View>)}</Card>}
        {!!message && <Text style={styles.error}>{message}</Text>}
      </ScreenContainer>
    </>
  );
}

function makeStyles(colors: ThemeColors) { return StyleSheet.create({
  title: { color: colors.text, fontFamily: theme.font.family.extraBold, fontSize: 16 },
  label: { color: colors.text, fontFamily: theme.font.family.bold, fontSize: 12 },
  help: { color: colors.textMuted, fontFamily: theme.font.family.medium, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, color: colors.text, fontFamily: theme.font.family.medium },
  roles: { flexDirection: "row", gap: 6, flexWrap: "wrap" }, role: { borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }, roleActive: { borderColor: colors.primary, backgroundColor: colors.inkSoft }, roleText: { color: colors.text, fontFamily: theme.font.family.semibold, fontSize: 11 },
  code: { color: colors.success, fontFamily: theme.font.family.extraBold, fontSize: 28, letterSpacing: 4, textAlign: "center" },
  member: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, flex: { flex: 1 }, memberName: { color: colors.text, fontFamily: theme.font.family.bold }, action: { color: colors.primary, fontFamily: theme.font.family.bold, fontSize: 10 }, remove: { color: colors.danger, fontFamily: theme.font.family.bold, fontSize: 10 },
  request: { gap: 7, paddingVertical: 8 }, error: { color: colors.danger, fontFamily: theme.font.family.semibold },
}); }
