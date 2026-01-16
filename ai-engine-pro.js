// =====================================================
// AI ENGINE PRO - DEBUG WRAPPER MODE
// OkrtSystem Labs – Learning Trace Enabled
// =====================================================

'use strict';

(function () {

    const DEBUG = true;

    function log(...args) {
        if (DEBUG) console.log('[AI-DEBUG]', ...args);
    }

    function group(title) {
        if (DEBUG) console.groupCollapsed('%c[AI-DEBUG] ' + title, 'color:#38bdf8;font-weight:bold;');
    }

    function groupEnd() {
        if (DEBUG) console.groupEnd();
    }

    function waitForEngine(cb) {
        let tries = 0;
        const t = setInterval(() => {
            if (window.AIEnginePro) {
                clearInterval(t);
                cb(window.AIEnginePro);
            }
            tries++;
            if (tries > 50) clearInterval(t);
        }, 100);
    }

    waitForEngine((Engine) => {

        log('Debug wrapper attached');

        // ===============================
        // Hook: Ensemble Evaluation
        // ===============================
        if (Engine.generateEnsemblePrediction) {
            const _origEnsemble = Engine.generateEnsemblePrediction.bind(Engine);

            Engine.generateEnsemblePrediction = function (marketState) {
                group('Ensemble Evaluation');

                log('MarketState snapshot:', marketState);

                const result = _origEnsemble(marketState);

                log('Direction:', result.direction);
                log('Confidence:', result.confidence);
                log('Session:', result.session);
                log('Volatility:', result.volScore);
                log('Breakout:', result.breakout?.classification);
                log('Regime:', result.regime);
                log('Model votes:', result.votes);
                log('Pattern match:', result.patternMatch);

                groupEnd();
                return result;
            };
        }

        // ===============================
        // Hook: Memory Query
        // ===============================
        if (Engine.queryLongTermMemory) {
            const _origMemory = Engine.queryLongTermMemory.bind(Engine);

            Engine.queryLongTermMemory = function (state) {
                group('Memory Query');

                const res = _origMemory(state);

                log('Query result:', res);

                groupEnd();
                return res;
            };
        }

        // ===============================
        // Hook: Store Pattern
        // ===============================
        if (Engine.storeInLongTermMemory) {
            const _origStore = Engine.storeInLongTermMemory.bind(Engine);

            Engine.storeInLongTermMemory = function (prediction, outcome) {
                group('Learning Store');

                log('Outcome:', outcome);
                log('Session:', prediction.session);
                log('Volatility:', prediction.volScore);
                log('Breakout:', prediction.breakout?.classification);
                log('Direction:', prediction.direction);
                log('Confidence:', prediction.confidence);

                const res = _origStore(prediction, outcome);

                log('Pattern stored');

                groupEnd();
                return res;
            };
        }

        // ===============================
        // Hook: Optimization Loop
        // ===============================
        if (Engine.runOptimization) {
            const _origOpt = Engine.runOptimization.bind(Engine);

            Engine.runOptimization = function () {
                group('Optimization Loop');

                log('Starting optimization cycle');

                const res = _origOpt();

                log('Optimization cycle completed');

                groupEnd();
                return res;
            };
        }

        // ===============================
        // Hook: Prediction Complete
        // ===============================
        if (Engine.verifyProPrediction) {
            const _origVerify = Engine.verifyProPrediction.bind(Engine);

            Engine.verifyProPrediction = function (prediction) {
                group('Prediction Verification');

                log('Verifying prediction:', prediction);

                const res = _origVerify(prediction);

                log('Verification result:', res);

                groupEnd();
                return res;
            };
        }

        log('All debug hooks installed');

    });

})();
