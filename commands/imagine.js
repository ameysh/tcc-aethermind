const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const { generateImage } = require('../lib/fooocus');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Generate an image)
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Prompt to generate')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const prompt = interaction.options.getString('prompt');

        try {
            // Generate image via Playwright + Fooocus UI automation
            const imgPath = await generateImage(prompt, { timeoutMs: 2 * 60 * 1000 });

            if (!imgPath) {
                await interaction.editReply('No image was generated or it could not be found.');
                return;
            }

            const fileName = path.basename(imgPath);
            await interaction.editReply({ content: `Here is your image for: "${prompt}"`, files: [{ attachment: imgPath, name: fileName }] });

        } catch (error) {
            console.error('Error in /imagine:', error);
            await interaction.editReply({ content: `Error generating image: ${error.message}` });
        }
    },
};
