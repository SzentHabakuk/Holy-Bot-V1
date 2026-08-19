const { Client, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder, REST, Routes, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ==================== BEÁLLÍTÁSOK ====================
const TOKEN = "MTUzODk4OTY3MTkzMTk2OTYyNg.GfA33d.pbs9yLwJQ2PtfUFyZnjfZQi4A1Tf3lXZw7hIXo";
const OWNER_ID = "861859179236425779"; 
// ====================================================

const CONFIG_FILE = path.join(__dirname, 'config.json');

let config = {};
if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Slash parancsok definíciója
const commands = [
    new SlashCommandBuilder()
        .setName('udvozlo')
        .setDescription('Beállítja az üdvözlő csatornát')
        .addChannelOption(option => 
            option.setName('csatorna').setDescription('Az üdvözlő csatorna').setRequired(true)),

    new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Beállítja az automatikusan kiosztandó rangot')
        .addRoleOption(option => 
            option.setName('rang').setDescription('A kiadandó rang').setRequired(true)),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Üzenetek tömeges törlése')
        .addIntegerOption(option =>
            option.setName('mennyiseg').setDescription('Törlendő üzenetek száma (1-100)').setRequired(true)),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Felhasználó kirúgása')
        .addUserOption(option => option.setName('felhasznalo').setDescription('A személy').setRequired(true))
        .addStringOption(option => option.setName('indok').setDescription('Indok')),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Felhasználó kitiltása')
        .addUserOption(option => option.setName('felhasznalo').setDescription('A személy').setRequired(true))
        .addStringOption(option => option.setName('indok').setDescription('Indok')),

    new SlashCommandBuilder()
        .setName('szerver')
        .setDescription('FiveM szerver kód és státusz csatorna beállítása')
        .addStringOption(option =>
            option.setName('kod').setDescription('A szerver cfx.re kódja (pl: 7r875b)').setRequired(true))
        .addChannelOption(option =>
            option.setName('csatorna').setDescription('A csatorna, ahová az élő státusz üzenetet küldje').setRequired(false))
].map(command => command.toJSON());

// FiveM Állapot Frissítő Függvény
async function updateFiveMStatus() {
    for (const guildId in config) {
        const guildConfig = config[guildId];
        if (!guildConfig || !guildConfig.fivemCode) continue;

        try {
            const response = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${guildConfig.fivemCode}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (response.ok) {
                const data = await response.json();
                const serverData = data.Data;
                const clients = serverData.clients || 0;
                const maxClients = serverData.sv_maxclients || 0;
                const hostname = serverData.hostname ? serverData.hostname.replace(/\^[0-9]/g, '') : 'FiveM Szerver';

                client.user.setActivity(`${clients}/${maxClients} játékos`, { type: ActivityType.Watching });

                if (guildConfig.fivemChannel) {
                    const channel = client.channels.cache.get(guildConfig.fivemChannel);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle(`🟢 Szerver Státusz: ONLINE`)
                            .setDescription(`**Szerver neve:**\n${hostname}\n\n**Játékosok:** ${clients} / ${maxClients}\n**CFX Kód:** \`${guildConfig.fivemCode}\``)
                            .setColor('#00FF00')
                            .setTimestamp();

                        if (guildConfig.fivemMessageId) {
                            try {
                                const msg = await channel.messages.fetch(guildConfig.fivemMessageId);
                                await msg.edit({ embeds: [embed] });
                            } catch {
                                const newMsg = await channel.send({ embeds: [embed] });
                                guildConfig.fivemMessageId = newMsg.id;
                                saveConfig();
                            }
                        } else {
                            const newMsg = await channel.send({ embeds: [embed] });
                            guildConfig.fivemMessageId = newMsg.id;
                            saveConfig();
                        }
                    }
                }
            } else {
                client.user.setActivity(`FiveM: Offline`, { type: ActivityType.Watching });
                if (guildConfig.fivemChannel) {
                    const channel = client.channels.cache.get(guildConfig.fivemChannel);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle(`🔴 Szerver Státusz: OFFLINE`)
                            .setDescription(`A szerver jelenleg nem elérhető.\n**CFX Kód:** \`${guildConfig.fivemCode}\``)
                            .setColor('#FF0000')
                            .setTimestamp();

                        if (guildConfig.fivemMessageId) {
                            try {
                                const msg = await channel.messages.fetch(guildConfig.fivemMessageId);
                                await msg.edit({ embeds: [embed] });
                            } catch {
                                const newMsg = await channel.send({ embeds: [embed] });
                                guildConfig.fivemMessageId = newMsg.id;
                                saveConfig();
                            }
                        } else {
                            const newMsg = await channel.send({ embeds: [embed] });
                            guildConfig.fivemMessageId = newMsg.id;
                            saveConfig();
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Hiba a FiveM státusz frissítésekor:', err.message);
        }
    }
}

// Bot indítása
client.once('ready', async () => {
    console.log(`Bot online! Bejelentkezve mint: ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('Slash parancsok frissítése...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Slash parancsok sikeresen regisztrálva!');
    } catch (error) {
        console.error('Hiba a parancsok regisztrálásakor:', error);
    }

    updateFiveMStatus();
    setInterval(updateFiveMStatus, 60000);
});

// Interakciók kezelése
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: '❌ Ezt a parancsot kizárólag a bot tulajdonosa használhatja!', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    if (!config[guildId]) config[guildId] = {};

    if (interaction.commandName === 'udvozlo') {
        const channel = interaction.options.getChannel('csatorna');
        config[guildId].welcomeChannel = channel.id;
        saveConfig();
        return interaction.reply({ content: `✅ Az üdvözlő csatorna beállítva: ${channel}`, ephemeral: true });
    }

    if (interaction.commandName === 'autorole') {
        const role = interaction.options.getRole('rang');
        config[guildId].autoRole = role.id;
        saveConfig();
        return interaction.reply({ content: `✅ Az automatikus rang beállítva: ${role}`, ephemeral: true });
    }

    if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('mennyiseg');
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: '❌ Adj meg egy számot 1 és 100 között!', ephemeral: true });
        }
        const deleted = await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `🧹 Sikeresen törölve **${deleted.size}** üzenet.`, ephemeral: true });
    }

    if (interaction.commandName === 'kick') {
        const user = interaction.options.getUser('felhasznalo');
        const reason = interaction.options.getString('indok') || 'Nincs megadva indok';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ A felhasználó nem található.', ephemeral: true });
        if (!member.kickable) return interaction.reply({ content: '❌ Nem tudom kirúgni ezt a személyt.', ephemeral: true });

        await member.kick(reason);
        return interaction.reply({ content: `👞 **${user.tag}** kirúgva. Indok: ${reason}` });
    }

    if (interaction.commandName === 'ban') {
        const user = interaction.options.getUser('felhasznalo');
        const reason = interaction.options.getString('indok') || 'Nincs megadva indok';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (member && !member.bannable) return interaction.reply({ content: '❌ Nem tudom kitiltani ezt a személyt.', ephemeral: true });

        await interaction.guild.members.ban(user.id, { reason });
        return interaction.reply({ content: `🔨 **${user.tag}** kitiltva. Indok: ${reason}` });
    }

    if (interaction.commandName === 'szerver') {
        const code = interaction.options.getString('kod');
        const channel = interaction.options.getChannel('csatorna');

        config[guildId].fivemCode = code;
        if (channel) {
            config[guildId].fivemChannel = channel.id;
            delete config[guildId].fivemMessageId; 
        }
        saveConfig();

        let replyMsg = `✅ FiveM szerver kód beállítva: \`${code}\`.`;
        if (channel) replyMsg += ` Élő státusz frissítve a(z) ${channel} szobában.`;

        await interaction.reply({ content: replyMsg, ephemeral: true });
        updateFiveMStatus();
    }
});

// Új tag belépése
client.on('guildMemberAdd', async member => {
    const guildConfig = config[member.guild.id];
    if (!guildConfig) return;

    if (guildConfig.autoRole) {
        try {
            const role = await member.guild.roles.fetch(guildConfig.autoRole);
            if (role) await member.roles.add(role);
        } catch (err) {
            console.error('Hiba a rang kiosztásakor:', err);
        }
    }

    if (guildConfig.welcomeChannel) {
        const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel);
        if (channel) {
            channel.send(`Szia ${member}! Üdvözöllek a **${member.guild.name}** szerverén!`);
        }
    }
});

client.login(TOKEN);
