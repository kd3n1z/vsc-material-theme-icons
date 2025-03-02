const { optimize } = require('svgo');
const { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } = require('fs');

function main() {
    rmSync('./dist', { force: true, recursive: true });
    mkdirSync('./dist/icons', { recursive: true });
    mkdirSync('./dist/variations');

    console.log('reading input...');

    const variationsConfig = JSON.parse(readFileUTF8('./src/variations.json'));
    const input = JSON.parse(readFileUTF8('./src/icons.json'));
    const package = JSON.parse(readFileUTF8('./package.json'));

    const iconsSet = new Set();

    for (const value of Object.values(input)) {
        if (typeof value === 'string') {
            iconsSet.add(value);
            continue;
        }

        for (const subvalue of Object.values(value)) {
            iconsSet.add(subvalue);
        }
    }

    const variableIcons = [];
    const normalIcons = [];

    for (const icon of iconsSet) {
        const iconPath = getIconPath(icon);

        if (!existsSync(iconPath)) {
            console.warn(`warn: icon '${icon}' (${iconPath}) not found`);
            continue;
        }

        if (variationsConfig.variableIcons.includes(icon)) {
            variableIcons.push(icon);
        } else {
            normalIcons.push(icon);
        }
    }

    input.iconDefinitions = {};
    input.hidesExplorerArrows = true;

    console.log('optimizing normal icons...');

    for (const icon of normalIcons) {
        const result = optimize(readFileUTF8(getIconPath(icon)), {
            multipass: true,
        });
        writeIcon(icon, result.data);

        input.iconDefinitions[icon] = { iconPath: '../icons/' + icon + '.svg' };
    }

    const iconThemes = [];

    const defaultColor = variationsConfig.variations.default;

    for (const [name, color] of Object.entries(variationsConfig.variations)) {
        const id = name.toLowerCase();
        console.log('generating variation ' + id + '...');

        let output = structuredClone(input);

        for (const icon of variableIcons) {
            const iconId = icon + '-' + id;

            const result = optimize(readFileUTF8(getIconPath(icon)).replaceAll(defaultColor, color), {
                multipass: true,
            });
            writeIcon(iconId, result.data);

            output.iconDefinitions[icon] = { iconPath: '../icons/' + iconId + '.svg' };
        }

        const jsonPath = './dist/variations/' + id + '.json';
        writeFileSync(jsonPath, JSON.stringify(output));

        output.hidesExplorerArrows = false;
        const jsonArrowsPath = './dist/variations/' + id + '-arrows.json';
        writeFileSync(jsonArrowsPath, JSON.stringify(output));

        iconThemes.push(
            {
                id: package.name + '-' + id,
                label: 'Material Theme Icons' + (id === 'default' ? '' : ' ' + name),
                path: jsonPath,
            },
            {
                id: package.name + '-' + id + '-arrows',
                label: 'Material Theme Icons' + (id === 'default' ? '' : ' ' + name) + ' (with arrows)',
                path: jsonArrowsPath,
            }
        );
    }

    console.log('updating package.json...');
    package.contributes.iconThemes = iconThemes;
    writeFileSync('./package.json', JSON.stringify(package, null, 4));

    console.log('everything done!');
}

function readFileUTF8(path) {
    return readFileSync(path, { encoding: 'utf8' });
}

function writeIcon(icon, data) {
    writeFileSync('./dist/icons/' + icon + '.svg', data);
}

function getIconPath(icon) {
    return './src/svgs/' + icon + '.svg';
}

main();
