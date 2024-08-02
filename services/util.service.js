export const log = (() => {
    let $styleChain = [];
    let $groupName;

    const ANSI_CODES = {
        reset: [0, 0],
        bold: [1, 22],
        dim: [2, 22],
        italic: [3, 23],
        underline: [4, 24],
        inverse: [7, 27],
        hidden: [8, 28],
        strikethrough: [9, 29],

        // Foreground colors
        black: [30, 39],
        red: [31, 39],
        green: [32, 39],
        yellow: [33, 39],
        blue: [34, 39],
        magenta: [35, 39],
        cyan: [36, 39],
        white: [37, 39],

        // Background colors
        bgBlack: [40, 49],
        bgRed: [41, 49],
        bgGreen: [42, 49],
        bgYellow: [43, 49],
        bgBlue: [44, 49],
        bgMagenta: [45, 49],
        bgCyan: [46, 49],
        bgWhite: [47, 49],
    };

    const $styleOptions = {
        // Basic colors and styles
        ...Object.keys(ANSI_CODES).reduce((acc, key) => {
            acc[key] = () => applyStyle(key);
            return acc;
        }, {}),

        // Dynamic styles
        rgb: (r, g, b) => applyStyle('color', `\x1b[38;2;${r};${g};${b}m`),
        bgRgb: (r, g, b) => applyStyle('bgColor', `\x1b[48;2;${r};${g};${b}m`),
    };

    const $logOptions = {

        log(...args) {
            _log(...args);
        }
    };

    function applyStyle(style, code) {
        return (...text) => {
            const openCode = code || `\x1b[${ANSI_CODES[style][0]}m`;
            const closeCode = code ? '\x1b[39m' : `\x1b[${ANSI_CODES[style][1]}m`;
            return {
                open: openCode,
                close: closeCode,
                toString() {
                    return `${openCode}${text.join(' ')}${closeCode}`;
                },
                ...Object.keys($styleOptions).reduce((acc, key) => {
                    acc[key] = $styleOptions[key];
                    return acc;
                }, {})
            };
        };
    }

    function _log(...args) {
        if ($groupName) _logGroup(...args);
        else _logStyled(...args);
        $groupName = '';
        $styleChain = [];
    }

    function _logGroup(...args) {
        console.group($groupName);
        _logStyled(...args);
        console.groupEnd();
    }

    function _logStyled(...args) {
        const styledArgs = $styleChain.reduce((acc, style) => {
            return style(acc.toString());
        }, args.join(' '));
        console.log(styledArgs.toString());
    }

    function _addStyle(style) {
        $styleChain.push(style);
        return _log;
    }

    for (const styleName in $styleOptions) {
        const getStyle = $styleOptions[styleName];
        // console.log('getStyle.length:', getStyle.length)
        Object.defineProperty(_log, styleName, {
            get() {
                return _addStyle(getStyle());
            }
        });
    }

    for (const opt in $logOptions) {
        const optMethod = $logOptions[opt];
        _log[opt] = optMethod;
    }

    return _log;
})();




export function padNum(num) {
    return (num + '').padStart(2, '0')
}

export function getDateData(dateStr) {
    const [day, month, year] = dateStr.split('.')
    return { day, month, year }
}

export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
