const { Client, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Config betöltése vagy létrehozása
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
        GatewayIntentBits.GuildMembers
    ]
});

// Slash parancsok definíciója
const commands = [
    new SlashCommandBuilder()
        .setName('udvozlo')
        .setDescription('Beállítja az üdvözlő csatornát')
        .addChannelOption(option => 
            option.setName('csatorna')
                .setDescription('A csatorna, ahová a bot küldje az üdvözlést')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Beállítja az automatikusan kiosztandó rangot')
        .addRoleOption(option => 
            option.setName('rang')
                .setDescription('A rang, amit az új tagok megkapnak')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// Bot indulása és parancsok regisztrálása
client.once('ready', async () => {
    console.log(`Bot online! Bejelentkezve mint: ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
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
});

// Parancsok kezelése
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guild.id;
    if (!config[guildId]) config[guildId] = {};

    if (interaction.commandName === 'udvozlo') {
        const channel = interaction.options.getChannel('csatorna');
        config[guildId].welcomeChannel = channel.id;
        saveConfig();

        await interaction.reply({ content: `✅ Az üdvözlő csatorna sikeresen beállítva: ${channel}`, ephemeral: true });
    }

    if (interaction.commandName === 'autorole') {
        const role = interaction.options.getRole('rang');
        config[guildId].autoRole = role.id;
        saveConfig();

        await interaction.reply({ content: `✅ Az automatikus rang sikeresen beállítva: ${role}`, ephemeral: true });
    }
});

// Új tag belépése
client.on('guildMemberAdd', async member => {
    const guildConfig = config[member.guild.id];
    if (!guildConfig) return;

    // Autorole kiosztása
    if (guildConfig.autoRole) {
        try {
            const role = await member.guild.roles.fetch(guildConfig.autoRole);
            if (role) await member.roles.add(role);
        } catch (err) {
            console.error('Hiba a rang kiosztásakor:', err);
        }
    }

    // Üdvözlő üzenet küldése
    if (guildConfig.welcomeChannel) {
        const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel);
        if (channel) {
            channel.send(`Szia ${member}! Üdvözöllek a **${member.guild.name}** szerverén!`);
        }
    }
});

// Token beolvasása környezeti változóból vagy configból
const TOKEN = process.env.TOKEN || "IDE_IRDHATOD_A_TOKENT_HA_NEM_ENV_T_HASZNALZS";
client.login(TOKEN);