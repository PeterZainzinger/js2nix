// @ts-check

const {promises: fs, existsSync} = require('fs');
const path = require('path');

/**
 * Copies a directory content.
 *
 * @param {string} src
 * @param {string} dest
 * @returns {Promise<unknown>}
 */
exports.copyDir = async function copyDir(src, dest) {
    await fs.mkdir(dest, {recursive: true});
    const entries = await fs.readdir(src, {withFileTypes: true});
    return Promise.all(
        entries.map(async entry => {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                await copyDir(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        })
    );
}

/**
 * Create a symlink of the module to given destination/target.
 *
 * @param {string} source
 * @param {string} dest
 */
exports.linkModule = async function linkModule(source, dest) {
    console.log("link module", source, dest)

    const realSource = await fs.realpath(source);
    const pkg = require(path.join(realSource, 'package.json'));
    if (pkg.name[0] === '@' && pkg.name.indexOf('/') !== -1) {
        await fs.mkdir(path.join(dest, pkg.name.split('/')[0]), {
            recursive: true,
        });
    }
    await forceLink(realSource, path.join(dest, pkg.name));
}

/**
 * Converts module name and its version into a folder name without slashes in it.
 *
 * @param {string} name
 * @param {string} version
 * @returns {string}
 */
exports.flatVersionedName = function flatVersionedName(name, version) {
    return name.replace('@', '').replace('/', '-') + '@' + version;
}

async function forceLink(source, dest) {
    console.log("link me")
    if (existsSync(dest)) {
        await fs.unlink(dest)
    }
    try{

        await fs.symlink(source, dest)
    }
    catch (e) {
        console.log("link error", e)
        await fs.unlink(dest)
        await fs.symlink(source, dest)
    }

}

/**
 * Links module's binaries into the destination
 *
 * @param {string} location - location of a module, binaries of whom need to be linked
 * @param {string} dest - destination folder location to link binaries into
 */
exports.linkBinaries = async function linkBinaries(location, dest) {
    const pkg = require(path.join(location, 'package.json'));
    console.log("## link binaries #1 - hasBin " + !!pkg.bin, location, dest)
    await fs.mkdir(dest, {recursive: true});

    if (pkg.bin) {
        console.log("# debug 2")
        if (typeof pkg.bin === 'string') {
            process.stdout.write('debug #3');
            const name = pkg.name.split('/').pop();
            process.stdout.write(
                '## Linking  ' + pkg.name + ' to ' + path.join(dest, name) + ' ... '
            );
            try {
                await forceLink(path.join(location, pkg.bin), path.join(dest, name));
                process.stdout.write('done!\n');
            } catch (e) {
                process.stdout.write('failed! #10\n');
                console.error(e);
            }
        } else if (Object.prototype.toString.call(pkg.bin).slice(8, -1) === 'Object') {
            process.stdout.write('debug #5');

            await Promise.all(
                Object.entries(pkg.bin).map(async ([target, source]) => {
                    process.stdout.write(
                        '## Linking 2' + source + ' to ' + path.join(dest, target) + ' ... '
                    );
                    try {
                        const targetPath = path.join(dest, target)
                        await forceLink(
                            path.join(location, source),
                            targetPath
                        );
                        process.stdout.write('done!\n');
                    } catch (e) {
                        process.stdout.write('failed #11!\n');
                        console.error(e);
                    }
                })
            );
        } else if (pkg.bin == undefined) {
            // Just skip
        } else {
            throw new Error(
                'Failed to link binaries declared in ' + JSON.stringify(pkg.bin)
            );
        }
    }
}
