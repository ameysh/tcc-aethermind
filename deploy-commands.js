const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];

// Load all command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.log(`Warning: Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Support multiple guild IDs separated by commas
        const guildIds = process.env.GUILD_ID ? process.env.GUILD_ID.split(',').map(id => id.trim()) : [];
        
        if (guildIds.length === 0 || (guildIds.length === 1 && guildIds[0] === 'global')) {
            console.log('Deploying globally to all servers (may take up to 1 hour to propagate)');
            // Deploy globally to all servers
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
            data.forEach(cmd => console.log(`  • /${cmd.name} - ${cmd.description}`));
        } else {
            console.log(`Deploying to ${guildIds.length} specific guild(s)`);
            
            // Deploy to each specified guild
            for (const guildId of guildIds) {
                try {
                    console.log(`Deploying to guild: ${guildId}`);
                    const data = await rest.put(
                        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                        { body: commands },
                    );
                    console.log(`✅ Successfully deployed ${data.length} commands to guild ${guildId}`);
                } catch (error) {
                    console.error(`❌ Failed to deploy to guild ${guildId}:`, error.message);
                }
            }
            
            console.log('\nCommands deployed:');
            commands.forEach(cmd => console.log(`  • /${cmd.name} - ${cmd.description}`));
        }
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();