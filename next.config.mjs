import TerserPlugin from "terser-webpack-plugin";
import webpack from "webpack";

/** @type {import('next').NextConfig} */
export default {
    devIndicators: {
        autoPrerender: false,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    /**
     * @param {import('webpack').Configuration} webpackConfig
     * @returns {import('webpack').Configuration}
     */
    webpack: (config, options) => {
        config.resolve.fallback = {
            net: false,
            crypto: false,
            fs: false,
            https: false,
            path: false,
            stream: false,
            http: false,
            timers: false,
            querystring: false,
            "@mantine/hooks": false,
            "zlib-sync": false,
            "worker_threads": false,
            'zlib': false,
            "erlpack": false,
            "cookiejar": false,
            "os": false,
            "ffmpeg-static": false,
            "ffmpeg-binaries": false,
            "utf-8-validate": false,
            request: false,
            "child_process": false,
            "@img/sharp-libvips-dev": false,
            "@img/sharp-wasm32": false
        };

        config.module.rules.push({
            test: /\.node/,
            use: 'node-loader'
        })
        config.externals = [...config.externals, 'bcrypt','discord.js'];

        if (options.isServer) {
            config.optimization = {
                ...config.optimization,
                minimize: false,
                minimizer: [
                    new TerserPlugin({
                        exclude: /[\\/]node_modules[\\/](discord\.js)[\\/]/,
                    }),
                ],
            };
        }

        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
                resource.request = resource.request.replace(/^node:/, "");
            }),
        )

        return config;
    }
};
