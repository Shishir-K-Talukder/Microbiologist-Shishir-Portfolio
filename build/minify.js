const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const UglifyJS = require('uglify-js');
const imagemin = require('imagemin');
const imageminWebp = require('imagemin-webp');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');

const cssDir = path.join(__dirname, '../css');
const jsDir = path.join(__dirname, '../js');
const imgDir = path.join(__dirname, '../assets/images');
const distDir = path.join(__dirname, '../dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
    fs.mkdirSync(path.join(distDir, 'css'));
    fs.mkdirSync(path.join(distDir, 'js'));
    fs.mkdirSync(path.join(distDir, 'assets'));
    fs.mkdirSync(path.join(distDir, 'assets/images'));
}

// Minify CSS
async function minifyCSS() {
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
    
    for (const file of cssFiles) {
        const filePath = path.join(cssDir, file);
        const css = fs.readFileSync(filePath, 'utf8');
        const minified = new CleanCSS({
            level: 2,
            compatibility: '*'
        }).minify(css);

        fs.writeFileSync(
            path.join(distDir, 'css', file.replace('.css', '.min.css')),
            minified.styles
        );
        console.log(`Minified ${file}`);
    }
}

// Minify JavaScript
async function minifyJS() {
    const jsFiles = fs.readdirSync(jsDir).filter(file => file.endsWith('.js'));
    
    for (const file of jsFiles) {
        const filePath = path.join(jsDir, file);
        const js = fs.readFileSync(filePath, 'utf8');
        const minified = UglifyJS.minify(js, {
            compress: {
                dead_code: true,
                drop_console: true,
                drop_debugger: true,
                keep_fnames: false,
                passes: 2
            },
            mangle: {
                toplevel: true
            }
        });

        if (minified.error) {
            console.error(`Error minifying ${file}:`, minified.error);
            continue;
        }

        fs.writeFileSync(
            path.join(distDir, 'js', file.replace('.js', '.min.js')),
            minified.code
        );
        console.log(`Minified ${file}`);
    }
}

// Optimize Images
async function optimizeImages() {
    const files = await imagemin([`${imgDir}/*.{jpg,png,webp}`], {
        destination: path.join(distDir, 'assets/images'),
        plugins: [
            imageminMozjpeg({
                quality: 80,
                progressive: true
            }),
            imageminPngquant({
                quality: [0.6, 0.8]
            }),
            imageminWebp({
                quality: 85,
                method: 6
            })
        ]
    });

    console.log('Images optimized:', files.length);
}

// Generate source maps
function generateSourceMaps() {
    // Add source map generation logic here if needed
}

// Run build process
async function build() {
    try {
        console.log('Starting build process...');
        
        await minifyCSS();
        console.log('CSS minification complete');
        
        await minifyJS();
        console.log('JavaScript minification complete');
        
        await optimizeImages();
        console.log('Image optimization complete');
        
        generateSourceMaps();
        console.log('Source maps generated');
        
        console.log('Build process completed successfully!');
    } catch (error) {
        console.error('Build process failed:', error);
        process.exit(1);
    }
}

// Run build
build();
