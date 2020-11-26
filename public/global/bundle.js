
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    /**
     * Hot module replacement for Svelte in the Wild
     *
     * @export
     * @param {object} Component Svelte component
     * @param {object} [options={ target: document.body }] Options for the Svelte component
     * @param {string} [id='hmr'] ID for the component container
     * @param {string} [eventName='app-loaded'] Name of the event that triggers replacement of previous component
     * @returns
     */
    function HMR(Component, options = { target: document.body }, id = 'hmr', eventName = 'app-loaded') {
        const oldContainer = document.getElementById(id);

        // Create the new (temporarily hidden) component container
        const appContainer = document.createElement("div");
        if (oldContainer) appContainer.style.visibility = 'hidden';
        else appContainer.setAttribute('id', id); //ssr doesn't get an event, so we set the id now

        // Attach it to the target element
        options.target.appendChild(appContainer);

        // Wait for the app to load before replacing the component
        addEventListener(eventName, replaceComponent);

        function replaceComponent() {
            if (oldContainer) oldContainer.remove();
            // Show our component and take over the ID of the old container
            appContainer.style.visibility = 'initial';
            // delete (appContainer.style.visibility)
            appContainer.setAttribute('id', id);
        }

        return new Component({
            ...options,
            target: appContainer
        });
    }

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.27.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    const MATCH_PARAM = RegExp(/\:([^/()]+)/g);

    function handleScroll (element) {
      if (navigator.userAgent.includes('jsdom')) return false
      scrollAncestorsToTop(element);
      handleHash();
    }

    function handleHash () {
      if (navigator.userAgent.includes('jsdom')) return false
      const { hash } = window.location;
      if (hash) {
        const validElementIdRegex = /^[A-Za-z]+[\w\-\:\.]*$/;
        if (validElementIdRegex.test(hash.substring(1))) {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView();
        }
      }
    }

    function scrollAncestorsToTop (element) {
      if (
        element &&
        element.scrollTo &&
        element.dataset.routify !== 'scroll-lock' &&
        element.dataset['routify-scroll'] !== 'lock'
      ) {
        element.style['scroll-behavior'] = 'auto';
        element.scrollTo({ top: 0, behavior: 'auto' });
        element.style['scroll-behavior'] = '';
        scrollAncestorsToTop(element.parentElement);
      }
    }

    const pathToRegex = (str, recursive) => {
      const suffix = recursive ? '' : '/?$'; //fallbacks should match recursively
      str = str.replace(/\/_fallback?$/, '(/|$)');
      str = str.replace(/\/index$/, '(/index)?'); //index files should be matched even if not present in url
      str = str.replace(MATCH_PARAM, '([^/]+)') + suffix;
      return str
    };

    const pathToParamKeys = string => {
      const paramsKeys = [];
      let matches;
      while ((matches = MATCH_PARAM.exec(string))) paramsKeys.push(matches[1]);
      return paramsKeys
    };

    const pathToRank = ({ path }) => {
      return path
        .split('/')
        .filter(Boolean)
        .map(str => (str === '_fallback' ? 'A' : str.startsWith(':') ? 'B' : 'C'))
        .join('')
    };

    let warningSuppressed = false;

    /* eslint no-console: 0 */
    function suppressWarnings () {
      if (warningSuppressed) return
      const consoleWarn = console.warn;
      console.warn = function (msg, ...msgs) {
        const ignores = [
          "was created with unknown prop 'scoped'",
          "was created with unknown prop 'scopedSync'",
        ];
        if (!ignores.find(iMsg => msg.includes(iMsg)))
          return consoleWarn(msg, ...msgs)
      };
      warningSuppressed = true;
    }

    function currentLocation () {
      const pathMatch = window.location.search.match(/__routify_path=([^&]+)/);
      const prefetchMatch = window.location.search.match(/__routify_prefetch=\d+/);
      window.routify = window.routify || {};
      window.routify.prefetched = prefetchMatch ? true : false;
      const path = pathMatch && pathMatch[1].replace(/[#?].+/, ''); // strip any thing after ? and #
      return path || window.location.pathname
    }

    window.routify = window.routify || {};

    /** @type {import('svelte/store').Writable<RouteNode>} */
    const route = writable(null); // the actual route being rendered

    /** @type {import('svelte/store').Writable<RouteNode[]>} */
    const routes = writable([]); // all routes
    routes.subscribe(routes => (window.routify.routes = routes));

    let rootContext = writable({ component: { params: {} } });

    /** @type {import('svelte/store').Writable<RouteNode>} */
    const urlRoute = writable(null);  // the route matching the url

    /** @type {import('svelte/store').Writable<String>} */
    const basepath = (() => {
        const { set, subscribe } = writable("");

        return {
            subscribe,
            set(value) {
                if (value.match(/^[/(]/))
                    set(value);
                else console.warn('Basepaths must start with / or (');
            },
            update() { console.warn('Use assignment or set to update basepaths.'); }
        }
    })();

    const location$1 = derived( // the part of the url matching the basepath
        [basepath, urlRoute],
        ([$basepath, $route]) => {
            const [, base, path] = currentLocation().match(`^(${$basepath})(${$route.regex})`) || [];
            return { base, path }
        }
    );

    const prefetchPath = writable("");

    function onAppLoaded({ path, metatags }) {
        metatags.update();
        const prefetchMatch = window.location.search.match(/__routify_prefetch=(\d+)/);
        const prefetchId = prefetchMatch && prefetchMatch[1];

        dispatchEvent(new CustomEvent('app-loaded'));
        parent.postMessage({
            msg: 'app-loaded',
            prefetched: window.routify.prefetched,
            path,
            prefetchId
        }, "*");
        window['routify'].appLoaded = true;
    }

    var defaultConfig = {
        queryHandler: {
            parse: search => fromEntries(new URLSearchParams(search)),
            stringify: params => '?' + (new URLSearchParams(params)).toString()
        }
    };


    function fromEntries(iterable) {
        return [...iterable].reduce((obj, [key, val]) => {
            obj[key] = val;
            return obj
        }, {})
    }

    /**
     * @param {string} url 
     * @return {ClientNode}
     */
    function urlToRoute(url) {
        /** @type {RouteNode[]} */
        const routes$1 = get_store_value(routes);
        const basepath$1 = get_store_value(basepath);
        const route = routes$1.find(route => url.match(`^${basepath$1}${route.regex}`));
        if (!route)
            throw new Error(
                `Route could not be found for "${url}".`
            )

        const [, base] = url.match(`^(${basepath$1})${route.regex}`);
        const path = url.slice(base.length);

        if (defaultConfig.queryHandler)
            route.params = defaultConfig.queryHandler.parse(window.location.search);

        if (route.paramKeys) {
            const layouts = layoutByPos(route.layouts);
            const fragments = path.split('/').filter(Boolean);
            const routeProps = getRouteProps(route.path);

            routeProps.forEach((prop, i) => {
                if (prop) {
                    route.params[prop] = fragments[i];
                    if (layouts[i]) layouts[i].param = { [prop]: fragments[i] };
                    else route.param = { [prop]: fragments[i] };
                }
            });
        }

        route.leftover = url.replace(new RegExp(base + route.regex), '');

        return route
    }


    /**
     * @param {array} layouts
     */
    function layoutByPos(layouts) {
        const arr = [];
        layouts.forEach(layout => {
            arr[layout.path.split('/').filter(Boolean).length - 1] = layout;
        });
        return arr
    }


    /**
     * @param {string} url
     */
    function getRouteProps(url) {
        return url
            .split('/')
            .filter(Boolean)
            .map(f => f.match(/\:(.+)/))
            .map(f => f && f[1])
    }

    /* node_modules\@sveltech\routify\runtime\Prefetcher.svelte generated by Svelte v3.27.0 */

    const { Object: Object_1 } = globals;
    const file = "node_modules\\@sveltech\\routify\\runtime\\Prefetcher.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (93:2) {#each $actives as prefetch (prefetch.options.prefetch)}
    function create_each_block(key_1, ctx) {
    	let iframe;
    	let iframe_src_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			iframe = element("iframe");
    			if (iframe.src !== (iframe_src_value = /*prefetch*/ ctx[1].url)) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "title", "routify prefetcher");
    			add_location(iframe, file, 93, 4, 2705);
    			this.first = iframe;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, iframe, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$actives*/ 1 && iframe.src !== (iframe_src_value = /*prefetch*/ ctx[1].url)) {
    				attr_dev(iframe, "src", iframe_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(iframe);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(93:2) {#each $actives as prefetch (prefetch.options.prefetch)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_value = /*$actives*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*prefetch*/ ctx[1].options.prefetch;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "id", "__routify_iframes");
    			set_style(div, "display", "none");
    			add_location(div, file, 91, 0, 2591);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$actives*/ 1) {
    				const each_value = /*$actives*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div, destroy_block, create_each_block, null, get_each_context);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const iframeNum = 2;

    const defaults = {
    	validFor: 60,
    	timeout: 5000,
    	gracePeriod: 1000
    };

    /** stores and subscriptions */
    const queue = writable([]);

    const actives = derived(queue, q => q.slice(0, iframeNum));

    actives.subscribe(actives => actives.forEach(({ options }) => {
    	setTimeout(() => removeFromQueue(options.prefetch), options.timeout);
    }));

    function prefetch(path, options = {}) {
    	prefetch.id = prefetch.id || 1;

    	path = !path.href
    	? path
    	: path.href.replace(/^(?:\/\/|[^/]+)*\//, "/");

    	//replace first ? since were mixing user queries with routify queries
    	path = path.replace("?", "&");

    	options = { ...defaults, ...options, path };
    	options.prefetch = prefetch.id++;

    	//don't prefetch within prefetch or SSR
    	if (window.routify.prefetched || navigator.userAgent.match("jsdom")) return false;

    	// add to queue
    	queue.update(q => {
    		if (!q.some(e => e.options.path === path)) q.push({
    			url: `/__app.html?${optionsToQuery(options)}`,
    			options
    		});

    		return q;
    	});
    }

    /**
     * convert options to query string
     * {a:1,b:2} becomes __routify_a=1&routify_b=2
     * @param {defaults & {path: string, prefetch: number}} options
     */
    function optionsToQuery(options) {
    	return Object.entries(options).map(([key, val]) => `__routify_${key}=${val}`).join("&");
    }

    /**
     * @param {number|MessageEvent} idOrEvent
     */
    function removeFromQueue(idOrEvent) {
    	const id = idOrEvent.data ? idOrEvent.data.prefetchId : idOrEvent;
    	if (!id) return null;
    	const entry = get_store_value(queue).find(entry => entry && entry.options.prefetch == id);

    	// removeFromQueue is called by both eventListener and timeout,
    	// but we can only remove the item once
    	if (entry) {
    		const { gracePeriod } = entry.options;
    		const gracePromise = new Promise(resolve => setTimeout(resolve, gracePeriod));

    		const idlePromise = new Promise(resolve => {
    				window.requestIdleCallback
    				? window.requestIdleCallback(resolve)
    				: setTimeout(resolve, gracePeriod + 1000);
    			});

    		Promise.all([gracePromise, idlePromise]).then(() => {
    			queue.update(q => q.filter(q => q.options.prefetch != id));
    		});
    	}
    }

    // Listen to message from child window
    addEventListener("message", removeFromQueue, false);

    function instance($$self, $$props, $$invalidate) {
    	let $actives;
    	validate_store(actives, "actives");
    	component_subscribe($$self, actives, $$value => $$invalidate(0, $actives = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Prefetcher", slots, []);
    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Prefetcher> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		writable,
    		derived,
    		get: get_store_value,
    		iframeNum,
    		defaults,
    		queue,
    		actives,
    		prefetch,
    		optionsToQuery,
    		removeFromQueue,
    		$actives
    	});

    	return [$actives];
    }

    class Prefetcher extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Prefetcher",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /// <reference path="../typedef.js" />

    /** @ts-check */
    /**
     * @typedef {Object} RoutifyContext
     * @prop {ClientNode} component
     * @prop {ClientNode} layout
     * @prop {any} componentFile 
     * 
     *  @returns {import('svelte/store').Readable<RoutifyContext>} */
    function getRoutifyContext() {
      return getContext('routify') || rootContext
    }

    /**
     * @callback AfterPageLoadHelper
     * @param {function} callback
     * 
     * @typedef {import('svelte/store').Readable<AfterPageLoadHelper> & {_hooks:Array<function>}} AfterPageLoadHelperStore
     * @type {AfterPageLoadHelperStore}
     */
    const afterPageLoad = {
      _hooks: [],
      subscribe: hookHandler
    };

    /** 
     * @callback BeforeUrlChangeHelper
     * @param {function} callback
     *
     * @typedef {import('svelte/store').Readable<BeforeUrlChangeHelper> & {_hooks:Array<function>}} BeforeUrlChangeHelperStore
     * @type {BeforeUrlChangeHelperStore}
     **/
    const beforeUrlChange = {
      _hooks: [],
      subscribe: hookHandler
    };

    function hookHandler(listener) {
      const hooks = this._hooks;
      const index = hooks.length;
      listener(callback => { hooks[index] = callback; });
      return () => delete hooks[index]
    }



    const _metatags = {
      props: {},
      templates: {},
      services: {
        plain: { propField: 'name', valueField: 'content' },
        twitter: { propField: 'name', valueField: 'content' },
        og: { propField: 'property', valueField: 'content' },
      },
      plugins: [
        {
          name: 'applyTemplate',
          condition: () => true,
          action: (prop, value) => {
            const template = _metatags.getLongest(_metatags.templates, prop) || (x => x);
            return [prop, template(value)]
          }
        },
        {
          name: 'createMeta',
          condition: () => true,
          action(prop, value) {
            _metatags.writeMeta(prop, value);
          }
        },
        {
          name: 'createOG',
          condition: prop => !prop.match(':'),
          action(prop, value) {
            _metatags.writeMeta(`og:${prop}`, value);
          }
        },
        {
          name: 'createTitle',
          condition: prop => prop === 'title',
          action(prop, value) {
            document.title = value;
          }
        }
      ],
      getLongest(repo, name) {
        const providers = repo[name];
        if (providers) {
          const currentPath = get_store_value(route).path;
          const allPaths = Object.keys(repo[name]);
          const matchingPaths = allPaths.filter(path => currentPath.includes(path));

          const longestKey = matchingPaths.sort((a, b) => b.length - a.length)[0];

          return providers[longestKey]
        }
      },
      writeMeta(prop, value) {
        const head = document.getElementsByTagName('head')[0];
        const match = prop.match(/(.+)\:/);
        const serviceName = match && match[1] || 'plain';
        const { propField, valueField } = metatags.services[serviceName] || metatags.services.plain;
        const oldElement = document.querySelector(`meta[${propField}='${prop}']`);
        if (oldElement) oldElement.remove();

        const newElement = document.createElement('meta');
        newElement.setAttribute(propField, prop);
        newElement.setAttribute(valueField, value);
        newElement.setAttribute('data-origin', 'routify');
        head.appendChild(newElement);
      },
      set(prop, value) {
        _metatags.plugins.forEach(plugin => {
          if (plugin.condition(prop, value))
            [prop, value] = plugin.action(prop, value) || [prop, value];
        });
      },
      clear() {
        const oldElement = document.querySelector(`meta`);
        if (oldElement) oldElement.remove();
      },
      template(name, fn) {
        const origin = _metatags.getOrigin();
        _metatags.templates[name] = _metatags.templates[name] || {};
        _metatags.templates[name][origin] = fn;
      },
      update() {
        Object.keys(_metatags.props).forEach((prop) => {
          let value = (_metatags.getLongest(_metatags.props, prop));
          _metatags.plugins.forEach(plugin => {
            if (plugin.condition(prop, value)) {
              [prop, value] = plugin.action(prop, value) || [prop, value];

            }
          });
        });
      },
      batchedUpdate() {
        if (!_metatags._pendingUpdate) {
          _metatags._pendingUpdate = true;
          setTimeout(() => {
            _metatags._pendingUpdate = false;
            this.update();
          });
        }
      },
      _updateQueued: false,
      getOrigin() {
        const routifyCtx = getRoutifyContext();
        return routifyCtx && get_store_value(routifyCtx).path || '/'
      },
      _pendingUpdate: false
    };


    /**
     * metatags
     * @prop {Object.<string, string>}
     */
    const metatags = new Proxy(_metatags, {
      set(target, name, value, receiver) {
        const { props, getOrigin } = target;

        if (Reflect.has(target, name))
          Reflect.set(target, name, value, receiver);
        else {
          props[name] = props[name] || {};
          props[name][getOrigin()] = value;
        }

        if (window['routify'].appLoaded)
          target.batchedUpdate();
        return true
      }
    });

    const isChangingPage = (function () {
      const store = writable(false);
      beforeUrlChange.subscribe(fn => fn(event => {
        store.set(true);
        return true
      }));
      
      afterPageLoad.subscribe(fn => fn(event => store.set(false)));

      return store
    })();

    /* node_modules\@sveltech\routify\runtime\Route.svelte generated by Svelte v3.27.0 */
    const file$1 = "node_modules\\@sveltech\\routify\\runtime\\Route.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i].component;
    	child_ctx[20] = list[i].componentFile;
    	return child_ctx;
    }

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i].component;
    	child_ctx[20] = list[i].componentFile;
    	return child_ctx;
    }

    // (120:0) {#if $context}
    function create_if_block_1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2, create_if_block_3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$context*/ ctx[6].component.isLayout === false) return 0;
    		if (/*remainingLayouts*/ ctx[5].length) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(target, anchor);
    			}

    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(120:0) {#if $context}",
    		ctx
    	});

    	return block;
    }

    // (132:36) 
    function create_if_block_3(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value_1 = [/*$context*/ ctx[6]];
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*component*/ ctx[19].path;
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);

    	for (let i = 0; i < 1; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < 1; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < 1; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$context, scoped, scopedSync, layout, remainingLayouts, decorator, Decorator, scopeToChild*/ 100663415) {
    				const each_value_1 = [/*$context*/ ctx[6]];
    				validate_each_argument(each_value_1);
    				group_outros();
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block_1, each_1_anchor, get_each_context_1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < 1; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 1; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < 1; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(132:36) ",
    		ctx
    	});

    	return block;
    }

    // (121:2) {#if $context.component.isLayout === false}
    function create_if_block_2(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value = [/*$context*/ ctx[6]];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*component*/ ctx[19].path;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < 1; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < 1; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < 1; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$context, scoped, scopedSync, layout*/ 85) {
    				const each_value = [/*$context*/ ctx[6]];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block$1, each_1_anchor, get_each_context$1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < 1; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 1; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < 1; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(121:2) {#if $context.component.isLayout === false}",
    		ctx
    	});

    	return block;
    }

    // (134:6) <svelte:component         this={componentFile}         let:scoped={scopeToChild}         let:decorator         {scoped}         {scopedSync}         {...layout.param || {}}>
    function create_default_slot(ctx) {
    	let route_1;
    	let t;
    	let current;

    	route_1 = new Route({
    			props: {
    				layouts: [.../*remainingLayouts*/ ctx[5]],
    				Decorator: typeof /*decorator*/ ctx[26] !== "undefined"
    				? /*decorator*/ ctx[26]
    				: /*Decorator*/ ctx[1],
    				childOfDecorator: /*layout*/ ctx[4].isDecorator,
    				scoped: {
    					.../*scoped*/ ctx[0],
    					.../*scopeToChild*/ ctx[25]
    				}
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route_1.$$.fragment);
    			t = space();
    		},
    		m: function mount(target, anchor) {
    			mount_component(route_1, target, anchor);
    			insert_dev(target, t, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route_1_changes = {};
    			if (dirty & /*remainingLayouts*/ 32) route_1_changes.layouts = [.../*remainingLayouts*/ ctx[5]];

    			if (dirty & /*decorator, Decorator*/ 67108866) route_1_changes.Decorator = typeof /*decorator*/ ctx[26] !== "undefined"
    			? /*decorator*/ ctx[26]
    			: /*Decorator*/ ctx[1];

    			if (dirty & /*layout*/ 16) route_1_changes.childOfDecorator = /*layout*/ ctx[4].isDecorator;

    			if (dirty & /*scoped, scopeToChild*/ 33554433) route_1_changes.scoped = {
    				.../*scoped*/ ctx[0],
    				.../*scopeToChild*/ ctx[25]
    			};

    			route_1.$set(route_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route_1, detaching);
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(134:6) <svelte:component         this={componentFile}         let:scoped={scopeToChild}         let:decorator         {scoped}         {scopedSync}         {...layout.param || {}}>",
    		ctx
    	});

    	return block;
    }

    // (133:4) {#each [$context] as { component, componentFile }
    function create_each_block_1(key_1, ctx) {
    	let first;
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ scoped: /*scoped*/ ctx[0] },
    		{ scopedSync: /*scopedSync*/ ctx[2] },
    		/*layout*/ ctx[4].param || {}
    	];

    	var switch_value = /*componentFile*/ ctx[20];

    	function switch_props(ctx) {
    		let switch_instance_props = {
    			$$slots: {
    				default: [
    					create_default_slot,
    					({ scoped: scopeToChild, decorator }) => ({ 25: scopeToChild, 26: decorator }),
    					({ scoped: scopeToChild, decorator }) => (scopeToChild ? 33554432 : 0) | (decorator ? 67108864 : 0)
    				]
    			},
    			$$scope: { ctx }
    		};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props(ctx));
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*scoped, scopedSync, layout*/ 21)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*scoped*/ 1 && { scoped: /*scoped*/ ctx[0] },
    					dirty & /*scopedSync*/ 4 && { scopedSync: /*scopedSync*/ ctx[2] },
    					dirty & /*layout*/ 16 && get_spread_object(/*layout*/ ctx[4].param || {})
    				])
    			: {};

    			if (dirty & /*$$scope, remainingLayouts, decorator, Decorator, layout, scoped, scopeToChild*/ 234881075) {
    				switch_instance_changes.$$scope = { dirty, ctx };
    			}

    			if (switch_value !== (switch_value = /*componentFile*/ ctx[20])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props(ctx));
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(133:4) {#each [$context] as { component, componentFile }",
    		ctx
    	});

    	return block;
    }

    // (122:4) {#each [$context] as { component, componentFile }
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ scoped: /*scoped*/ ctx[0] },
    		{ scopedSync: /*scopedSync*/ ctx[2] },
    		/*layout*/ ctx[4].param || {}
    	];

    	var switch_value = /*componentFile*/ ctx[20];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*scoped, scopedSync, layout*/ 21)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*scoped*/ 1 && { scoped: /*scoped*/ ctx[0] },
    					dirty & /*scopedSync*/ 4 && { scopedSync: /*scopedSync*/ ctx[2] },
    					dirty & /*layout*/ 16 && get_spread_object(/*layout*/ ctx[4].param || {})
    				])
    			: {};

    			if (switch_value !== (switch_value = /*componentFile*/ ctx[20])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(122:4) {#each [$context] as { component, componentFile }",
    		ctx
    	});

    	return block;
    }

    // (152:0) {#if !parentElement}
    function create_if_block(ctx) {
    	let span;
    	let setParent_action;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			span = element("span");
    			add_location(span, file$1, 152, 2, 4450);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);

    			if (!mounted) {
    				dispose = action_destroyer(setParent_action = /*setParent*/ ctx[8].call(null, span));
    				mounted = true;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(152:0) {#if !parentElement}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let t;
    	let if_block1_anchor;
    	let current;
    	let if_block0 = /*$context*/ ctx[6] && create_if_block_1(ctx);
    	let if_block1 = !/*parentElement*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$context*/ ctx[6]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*$context*/ 64) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (!/*parentElement*/ ctx[3]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $route;
    	let $context;
    	validate_store(route, "route");
    	component_subscribe($$self, route, $$value => $$invalidate(14, $route = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Route", slots, []);
    	let { layouts = [] } = $$props;
    	let { scoped = {} } = $$props;
    	let { Decorator = null } = $$props;
    	let { childOfDecorator = false } = $$props;
    	let { isRoot = false } = $$props;
    	let scopedSync = {};
    	let isDecorator = false;

    	/** @type {HTMLElement} */
    	let parentElement;

    	/** @type {LayoutOrDecorator} */
    	let layout = null;

    	/** @type {LayoutOrDecorator} */
    	let lastLayout = null;

    	/** @type {LayoutOrDecorator[]} */
    	let remainingLayouts = [];

    	const context = writable(null);
    	validate_store(context, "context");
    	component_subscribe($$self, context, value => $$invalidate(6, $context = value));

    	/** @type {import("svelte/store").Writable<Context>} */
    	const parentContextStore = getContext("routify");

    	isDecorator = Decorator && !childOfDecorator;
    	setContext("routify", context);

    	/** @param {HTMLElement} el */
    	function setParent(el) {
    		$$invalidate(3, parentElement = el.parentElement);
    	}

    	/** @param {SvelteComponent} componentFile */
    	function onComponentLoaded(componentFile) {
    		/** @type {Context} */
    		const parentContext = get_store_value(parentContextStore);

    		$$invalidate(2, scopedSync = { ...scoped });
    		lastLayout = layout;
    		if (remainingLayouts.length === 0) onLastComponentLoaded();

    		const ctx = {
    			layout: isDecorator ? parentContext.layout : layout,
    			component: layout,
    			route: $route,
    			componentFile,
    			child: isDecorator
    			? parentContext.child
    			: get_store_value(context) && get_store_value(context).child
    		};

    		context.set(ctx);
    		if (isRoot) rootContext.set(ctx);

    		if (parentContext && !isDecorator) parentContextStore.update(store => {
    			store.child = layout || store.child;
    			return store;
    		});
    	}

    	/**  @param {LayoutOrDecorator} layout */
    	function setComponent(layout) {
    		let PendingComponent = layout.component();
    		if (PendingComponent instanceof Promise) PendingComponent.then(onComponentLoaded); else onComponentLoaded(PendingComponent);
    	}

    	async function onLastComponentLoaded() {
    		afterPageLoad._hooks.forEach(hook => hook(layout.api));
    		await tick();
    		handleScroll(parentElement);

    		if (!window["routify"].appLoaded) {
    			const pagePath = $context.component.path;
    			const routePath = $route.path;
    			const isOnCurrentRoute = pagePath === routePath; //maybe we're getting redirected

    			// Let everyone know the last child has rendered
    			if (!window["routify"].stopAutoReady && isOnCurrentRoute) {
    				onAppLoaded({ path: pagePath, metatags });
    			}
    		}
    	}

    	const writable_props = ["layouts", "scoped", "Decorator", "childOfDecorator", "isRoot"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Route> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("layouts" in $$props) $$invalidate(9, layouts = $$props.layouts);
    		if ("scoped" in $$props) $$invalidate(0, scoped = $$props.scoped);
    		if ("Decorator" in $$props) $$invalidate(1, Decorator = $$props.Decorator);
    		if ("childOfDecorator" in $$props) $$invalidate(10, childOfDecorator = $$props.childOfDecorator);
    		if ("isRoot" in $$props) $$invalidate(11, isRoot = $$props.isRoot);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		setContext,
    		onDestroy,
    		onMount,
    		tick,
    		writable,
    		get: get_store_value,
    		metatags,
    		afterPageLoad,
    		route,
    		routes,
    		rootContext,
    		handleScroll,
    		onAppLoaded,
    		layouts,
    		scoped,
    		Decorator,
    		childOfDecorator,
    		isRoot,
    		scopedSync,
    		isDecorator,
    		parentElement,
    		layout,
    		lastLayout,
    		remainingLayouts,
    		context,
    		parentContextStore,
    		setParent,
    		onComponentLoaded,
    		setComponent,
    		onLastComponentLoaded,
    		$route,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ("layouts" in $$props) $$invalidate(9, layouts = $$props.layouts);
    		if ("scoped" in $$props) $$invalidate(0, scoped = $$props.scoped);
    		if ("Decorator" in $$props) $$invalidate(1, Decorator = $$props.Decorator);
    		if ("childOfDecorator" in $$props) $$invalidate(10, childOfDecorator = $$props.childOfDecorator);
    		if ("isRoot" in $$props) $$invalidate(11, isRoot = $$props.isRoot);
    		if ("scopedSync" in $$props) $$invalidate(2, scopedSync = $$props.scopedSync);
    		if ("isDecorator" in $$props) $$invalidate(12, isDecorator = $$props.isDecorator);
    		if ("parentElement" in $$props) $$invalidate(3, parentElement = $$props.parentElement);
    		if ("layout" in $$props) $$invalidate(4, layout = $$props.layout);
    		if ("lastLayout" in $$props) lastLayout = $$props.lastLayout;
    		if ("remainingLayouts" in $$props) $$invalidate(5, remainingLayouts = $$props.remainingLayouts);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*isDecorator, Decorator, layouts*/ 4610) {
    			 if (isDecorator) {
    				const decoratorLayout = {
    					component: () => Decorator,
    					path: `${layouts[0].path}__decorator`,
    					isDecorator: true
    				};

    				$$invalidate(9, layouts = [decoratorLayout, ...layouts]);
    			}
    		}

    		if ($$self.$$.dirty & /*layouts*/ 512) {
    			 $$invalidate(4, [layout, ...remainingLayouts] = layouts, layout, ((($$invalidate(5, remainingLayouts), $$invalidate(9, layouts)), $$invalidate(12, isDecorator)), $$invalidate(1, Decorator)));
    		}

    		if ($$self.$$.dirty & /*layout*/ 16) {
    			 setComponent(layout);
    		}
    	};

    	return [
    		scoped,
    		Decorator,
    		scopedSync,
    		parentElement,
    		layout,
    		remainingLayouts,
    		$context,
    		context,
    		setParent,
    		layouts,
    		childOfDecorator,
    		isRoot
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			layouts: 9,
    			scoped: 0,
    			Decorator: 1,
    			childOfDecorator: 10,
    			isRoot: 11
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get layouts() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set layouts(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scoped() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scoped(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get Decorator() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set Decorator(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get childOfDecorator() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set childOfDecorator(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isRoot() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isRoot(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function init$1(routes, callback) {
      /** @type { ClientNode | false } */
      let lastRoute = false;

      function updatePage(proxyToUrl, shallow) {
        const url = proxyToUrl || currentLocation();
        const route$1 = urlToRoute(url);
        const currentRoute = shallow && urlToRoute(currentLocation());
        const contextRoute = currentRoute || route$1;
        const layouts = [...contextRoute.layouts, route$1];
        if (lastRoute) delete lastRoute.last; //todo is a page component the right place for the previous route?
        route$1.last = lastRoute;
        lastRoute = route$1;

        //set the route in the store
        if (!proxyToUrl)
          urlRoute.set(route$1);
        route.set(route$1);

        //run callback in Router.svelte
        callback(layouts);
      }

      const destroy = createEventListeners(updatePage);

      return { updatePage, destroy }
    }

    /**
     * svelte:window events doesn't work on refresh
     * @param {Function} updatePage
     */
    function createEventListeners(updatePage) {
    ['pushState', 'replaceState'].forEach(eventName => {
        const fn = history[eventName];
        history[eventName] = async function (state = {}, title, url) {
          const { id, path, params } = get_store_value(route);
          state = { id, path, params, ...state };
          const event = new Event(eventName.toLowerCase());
          Object.assign(event, { state, title, url });

          if (await runHooksBeforeUrlChange(event)) {
            fn.apply(this, [state, title, url]);
            return dispatchEvent(event)
          }
        };
      });

      let _ignoreNextPop = false;

      const listeners = {
        click: handleClick,
        pushstate: () => updatePage(),
        replacestate: () => updatePage(),
        popstate: async event => {
          if (_ignoreNextPop)
            _ignoreNextPop = false;
          else {
            if (await runHooksBeforeUrlChange(event)) {
              updatePage();
            } else {
              _ignoreNextPop = true;
              event.preventDefault();
              history.go(1);
            }
          }
        },
      };

      Object.entries(listeners).forEach(args => addEventListener(...args));

      const unregister = () => {
        Object.entries(listeners).forEach(args => removeEventListener(...args));
      };

      return unregister
    }

    function handleClick(event) {
      const el = event.target.closest('a');
      const href = el && el.getAttribute('href');

      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.button ||
        event.defaultPrevented
      )
        return
      if (!href || el.target || el.host !== location.host) return

      event.preventDefault();
      history.pushState({}, '', href);
    }

    async function runHooksBeforeUrlChange(event) {
      const route$1 = get_store_value(route);
      for (const hook of beforeUrlChange._hooks.filter(Boolean)) {
        // return false if the hook returns false
        const result = await hook(event, route$1); //todo remove route from hook. Its API Can be accessed as $page
        if (!result) return false
      }
      return true
    }

    /* node_modules\@sveltech\routify\runtime\Router.svelte generated by Svelte v3.27.0 */

    const { Object: Object_1$1 } = globals;

    // (64:0) {#if layouts && $route !== null}
    function create_if_block$1(ctx) {
    	let route_1;
    	let current;

    	route_1 = new Route({
    			props: {
    				layouts: /*layouts*/ ctx[0],
    				isRoot: true
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(route_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route_1_changes = {};
    			if (dirty & /*layouts*/ 1) route_1_changes.layouts = /*layouts*/ ctx[0];
    			route_1.$set(route_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(64:0) {#if layouts && $route !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let t;
    	let prefetcher;
    	let current;
    	let if_block = /*layouts*/ ctx[0] && /*$route*/ ctx[1] !== null && create_if_block$1(ctx);
    	prefetcher = new Prefetcher({ $$inline: true });

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();
    			create_component(prefetcher.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(prefetcher, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*layouts*/ ctx[0] && /*$route*/ ctx[1] !== null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*layouts, $route*/ 3) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(prefetcher.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(prefetcher.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(prefetcher, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $route;
    	validate_store(route, "route");
    	component_subscribe($$self, route, $$value => $$invalidate(1, $route = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Router", slots, []);
    	let { routes: routes$1 } = $$props;
    	let { config = {} } = $$props;
    	let layouts;
    	let navigator;
    	window.routify = window.routify || {};
    	window.routify.inBrowser = !window.navigator.userAgent.match("jsdom");

    	Object.entries(config).forEach(([key, value]) => {
    		defaultConfig[key] = value;
    	});

    	suppressWarnings();
    	const updatePage = (...args) => navigator && navigator.updatePage(...args);
    	setContext("routifyupdatepage", updatePage);
    	const callback = res => $$invalidate(0, layouts = res);

    	const cleanup = () => {
    		if (!navigator) return;
    		navigator.destroy();
    		navigator = null;
    	};

    	let initTimeout = null;

    	// init is async to prevent a horrible bug that completely disable reactivity
    	// in the host component -- something like the component's update function is
    	// called before its fragment is created, and since the component is then seen
    	// as already dirty, it is never scheduled for update again, and remains dirty
    	// forever... I failed to isolate the precise conditions for the bug, but the
    	// faulty update is triggered by a change in the route store, and so offseting
    	// store initialization by one tick gives the host component some time to
    	// create its fragment. The root cause it probably a bug in Svelte with deeply
    	// intertwinned store and reactivity.
    	const doInit = () => {
    		clearTimeout(initTimeout);

    		initTimeout = setTimeout(() => {
    			cleanup();
    			navigator = init$1(routes$1, callback);
    			routes.set(routes$1);
    			navigator.updatePage();
    		});
    	};

    	onDestroy(cleanup);
    	const writable_props = ["routes", "config"];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("routes" in $$props) $$invalidate(2, routes$1 = $$props.routes);
    		if ("config" in $$props) $$invalidate(3, config = $$props.config);
    	};

    	$$self.$capture_state = () => ({
    		setContext,
    		onDestroy,
    		Route,
    		Prefetcher,
    		init: init$1,
    		route,
    		routesStore: routes,
    		prefetchPath,
    		suppressWarnings,
    		defaultConfig,
    		routes: routes$1,
    		config,
    		layouts,
    		navigator,
    		updatePage,
    		callback,
    		cleanup,
    		initTimeout,
    		doInit,
    		$route
    	});

    	$$self.$inject_state = $$props => {
    		if ("routes" in $$props) $$invalidate(2, routes$1 = $$props.routes);
    		if ("config" in $$props) $$invalidate(3, config = $$props.config);
    		if ("layouts" in $$props) $$invalidate(0, layouts = $$props.layouts);
    		if ("navigator" in $$props) navigator = $$props.navigator;
    		if ("initTimeout" in $$props) initTimeout = $$props.initTimeout;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*routes*/ 4) {
    			 if (routes$1) doInit();
    		}
    	};

    	return [layouts, $route, routes$1, config];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { routes: 2, config: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*routes*/ ctx[2] === undefined && !("routes" in props)) {
    			console.warn("<Router> was created without expected prop 'routes'");
    		}
    	}

    	get routes() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get config() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set config(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /** 
     * Node payload
     * @typedef {Object} NodePayload
     * @property {RouteNode=} file current node
     * @property {RouteNode=} parent parent of the current node
     * @property {StateObject=} state state shared by every node in the walker
     * @property {Object=} scope scope inherited by descendants in the scope
     *
     * State Object
     * @typedef {Object} StateObject
     * @prop {TreePayload=} treePayload payload from the tree
     * 
     * Node walker proxy
     * @callback NodeWalkerProxy
     * @param {NodePayload} NodePayload
     */


    /**
     * Node middleware
     * @description Walks through the nodes of a tree
     * @example middleware = createNodeMiddleware(payload => {payload.file.name = 'hello'})(treePayload))
     * @param {NodeWalkerProxy} fn 
     */
    function createNodeMiddleware(fn) {

        /**    
         * NodeMiddleware payload receiver
         * @param {TreePayload} payload
         */
        const inner = async function execute(payload) {
            return await nodeMiddleware(payload.tree, fn, { state: { treePayload: payload } })
        };

        /**    
         * NodeMiddleware sync payload receiver
         * @param {TreePayload} payload
         */
        inner.sync = function executeSync(payload) {
            return nodeMiddlewareSync(payload.tree, fn, { state: { treePayload: payload } })
        };

        return inner
    }

    /**
     * Node walker
     * @param {Object} file mutable file
     * @param {NodeWalkerProxy} fn function to be called for each file
     * @param {NodePayload=} payload 
     */
    async function nodeMiddleware(file, fn, payload) {
        const { state, scope, parent } = payload || {};
        payload = {
            file,
            parent,
            state: state || {},            //state is shared by all files in the walk
            scope: clone(scope || {}),     //scope is inherited by descendants
        };

        await fn(payload);

        if (file.children) {
            payload.parent = file;
            await Promise.all(file.children.map(_file => nodeMiddleware(_file, fn, payload)));
        }
        return payload
    }

    /**
     * Node walker (sync version)
     * @param {Object} file mutable file
     * @param {NodeWalkerProxy} fn function to be called for each file
     * @param {NodePayload=} payload 
     */
    function nodeMiddlewareSync(file, fn, payload) {
        const { state, scope, parent } = payload || {};
        payload = {
            file,
            parent,
            state: state || {},            //state is shared by all files in the walk
            scope: clone(scope || {}),     //scope is inherited by descendants
        };

        fn(payload);

        if (file.children) {
            payload.parent = file;
            file.children.map(_file => nodeMiddlewareSync(_file, fn, payload));
        }
        return payload
    }


    /**
     * Clone with JSON
     * @param {T} obj 
     * @returns {T} JSON cloned object
     * @template T
     */
    function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

    const setRegex = createNodeMiddleware(({ file }) => {
        if (file.isPage || file.isFallback)
            file.regex = pathToRegex(file.path, file.isFallback);
    });
    const setParamKeys = createNodeMiddleware(({ file }) => {
        file.paramKeys = pathToParamKeys(file.path);
    });

    const setShortPath = createNodeMiddleware(({ file }) => {
        if (file.isFallback || file.isIndex)
            file.shortPath = file.path.replace(/\/[^/]+$/, '');
        else file.shortPath = file.path;
    });
    const setRank = createNodeMiddleware(({ file }) => {
        file.ranking = pathToRank(file);
    });


    // todo delete?
    const addMetaChildren = createNodeMiddleware(({ file }) => {
        const node = file;
        const metaChildren = file.meta && file.meta.children || [];
        if (metaChildren.length) {
            node.children = node.children || [];
            node.children.push(...metaChildren.map(meta => ({ isMeta: true, ...meta, meta })));
        }
    });

    const setIsIndexable = createNodeMiddleware(payload => {
        const { file } = payload;
        const { isLayout, isFallback, meta } = file;
        file.isIndexable = !isLayout && !isFallback && meta.index !== false;
        file.isNonIndexable = !file.isIndexable;
    });


    const assignRelations = createNodeMiddleware(({ file, parent }) => {
        Object.defineProperty(file, 'parent', { get: () => parent });
        Object.defineProperty(file, 'nextSibling', { get: () => _getSibling(file, 1) });
        Object.defineProperty(file, 'prevSibling', { get: () => _getSibling(file, -1) });
        Object.defineProperty(file, 'lineage', { get: () => _getLineage(parent) });
    });

    function _getLineage(node, lineage = []){
        if(node){
            lineage.unshift(node);
            _getLineage(node.parent, lineage);
        }
        return lineage
    }

    /**
     * 
     * @param {RouteNode} file 
     * @param {Number} direction 
     */
    function _getSibling(file, direction) {
        if (!file.root) {
            const siblings = file.parent.children.filter(c => c.isIndexable);
            const index = siblings.indexOf(file);
            return siblings[index + direction]
        }
    }

    const assignIndex = createNodeMiddleware(({ file, parent }) => {
        if (file.isIndex) Object.defineProperty(parent, 'index', { get: () => file });
        if (file.isLayout)
            Object.defineProperty(parent, 'layout', { get: () => file });
    });

    const assignLayout = createNodeMiddleware(({ file, scope }) => {
        Object.defineProperty(file, 'layouts', { get: () => getLayouts(file) });
        function getLayouts(file) {
            const { parent } = file;
            const layout = parent && parent.layout;
            const isReset = layout && layout.isReset;
            const layouts = (parent && !isReset && getLayouts(parent)) || [];
            if (layout) layouts.push(layout);
            return layouts
        }
    });


    const createFlatList = treePayload => {
        createNodeMiddleware(payload => {
            if (payload.file.isPage || payload.file.isFallback)
            payload.state.treePayload.routes.push(payload.file);
        }).sync(treePayload);    
        treePayload.routes.sort((c, p) => (c.ranking >= p.ranking ? -1 : 1));
    };

    const setPrototype = createNodeMiddleware(({ file }) => {
        const Prototype = file.root
            ? Root
            : file.children
                ? file.isFile ? PageDir : Dir
                : file.isReset
                    ? Reset
                    : file.isLayout
                        ? Layout
                        : file.isFallback
                            ? Fallback
                            : Page;
        Object.setPrototypeOf(file, Prototype.prototype);

        function Layout() { }
        function Dir() { }
        function Fallback() { }
        function Page() { }
        function PageDir() { }
        function Reset() { }
        function Root() { }
    });

    var miscPlugins = /*#__PURE__*/Object.freeze({
        __proto__: null,
        setRegex: setRegex,
        setParamKeys: setParamKeys,
        setShortPath: setShortPath,
        setRank: setRank,
        addMetaChildren: addMetaChildren,
        setIsIndexable: setIsIndexable,
        assignRelations: assignRelations,
        assignIndex: assignIndex,
        assignLayout: assignLayout,
        createFlatList: createFlatList,
        setPrototype: setPrototype
    });

    const assignAPI = createNodeMiddleware(({ file }) => {
        file.api = new ClientApi(file);
    });

    class ClientApi {
        constructor(file) {
            this.__file = file;
            Object.defineProperty(this, '__file', { enumerable: false });
            this.isMeta = !!file.isMeta;
            this.path = file.path;
            this.title = _prettyName(file);
            this.meta = file.meta;
        }

        get parent() { return !this.__file.root && this.__file.parent.api }
        get children() {
            return (this.__file.children || this.__file.isLayout && this.__file.parent.children || [])
                .filter(c => !c.isNonIndexable)
                .sort((a, b) => {
                    if(a.isMeta && b.isMeta) return 0
                    a = (a.meta.index || a.meta.title || a.path).toString();
                    b = (b.meta.index || b.meta.title || b.path).toString();
                    return a.localeCompare((b), undefined, { numeric: true, sensitivity: 'base' })
                })
                .map(({ api }) => api)
        }
        get next() { return _navigate(this, +1) }
        get prev() { return _navigate(this, -1) }
        preload() {
            this.__file.layouts.forEach(file => file.component());
            this.__file.component(); 
        }
    }

    function _navigate(node, direction) {
        if (!node.__file.root) {
            const siblings = node.parent.children;
            const index = siblings.indexOf(node);
            return node.parent.children[index + direction]
        }
    }


    function _prettyName(file) {
        if (typeof file.meta.title !== 'undefined') return file.meta.title
        else return (file.shortPath || file.path)
            .split('/')
            .pop()
            .replace(/-/g, ' ')
    }

    const plugins = {...miscPlugins, assignAPI};

    function buildClientTree(tree) {
      const order = [
        // pages
        "setParamKeys", //pages only
        "setRegex", //pages only
        "setShortPath", //pages only
        "setRank", //pages only
        "assignLayout", //pages only,
        // all
        "setPrototype",
        "addMetaChildren",
        "assignRelations", //all (except meta components?)
        "setIsIndexable", //all
        "assignIndex", //all
        "assignAPI", //all
        // routes
        "createFlatList"
      ];

      const payload = { tree, routes: [] };
      for (let name of order) {
        const syncFn = plugins[name].sync || plugins[name];
        syncFn(payload);
      }
      return payload
    }

    /* src\pages\about.svelte generated by Svelte v3.27.0 */

    const file$2 = "src\\pages\\about.svelte";

    function create_fragment$3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "test!";
    			add_location(div, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("About", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<About> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function getCjsExportFromNamespace (n) {
    	return n && n['default'] || n;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var Global = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    var PI_OVER_180 = Math.PI / 180;
    function detectBrowser() {
        return (typeof window !== 'undefined' &&
            ({}.toString.call(window) === '[object Window]' ||
                {}.toString.call(window) === '[object global]'));
    }
    var _detectIE = function (ua) {
        var msie = ua.indexOf('msie ');
        if (msie > 0) {
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }
        var trident = ua.indexOf('trident/');
        if (trident > 0) {
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }
        var edge = ua.indexOf('edge/');
        if (edge > 0) {
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }
        return false;
    };
    exports._parseUA = function (userAgent) {
        var ua = userAgent.toLowerCase(), match = /(chrome)[ /]([\w.]+)/.exec(ua) ||
            /(webkit)[ /]([\w.]+)/.exec(ua) ||
            /(opera)(?:.*version|)[ /]([\w.]+)/.exec(ua) ||
            /(msie) ([\w.]+)/.exec(ua) ||
            (ua.indexOf('compatible') < 0 &&
                /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua)) ||
            [], mobile = !!userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i), ieMobile = !!userAgent.match(/IEMobile/i);
        return {
            browser: match[1] || '',
            version: match[2] || '0',
            isIE: _detectIE(ua),
            mobile: mobile,
            ieMobile: ieMobile
        };
    };
    exports.glob = typeof commonjsGlobal !== 'undefined'
        ? commonjsGlobal
        : typeof window !== 'undefined'
            ? window
            : typeof WorkerGlobalScope !== 'undefined'
                ? self
                : {};
    exports.Konva = {
        _global: exports.glob,
        version: '7.1.3',
        isBrowser: detectBrowser(),
        isUnminified: /param/.test(function (param) { }.toString()),
        dblClickWindow: 400,
        getAngle: function (angle) {
            return exports.Konva.angleDeg ? angle * PI_OVER_180 : angle;
        },
        enableTrace: false,
        _pointerEventsEnabled: false,
        hitOnDragEnabled: false,
        captureTouchEventsEnabled: false,
        listenClickTap: false,
        inDblClickWindow: false,
        pixelRatio: undefined,
        dragDistance: 3,
        angleDeg: true,
        showWarnings: true,
        dragButtons: [0, 1],
        isDragging: function () {
            return exports.Konva['DD'].isDragging;
        },
        isDragReady: function () {
            return !!exports.Konva['DD'].node;
        },
        UA: exports._parseUA((exports.glob.navigator && exports.glob.navigator.userAgent) || ''),
        document: exports.glob.document,
        _injectGlobal: function (Konva) {
            exports.glob.Konva = Konva;
        },
        _parseUA: exports._parseUA
    };
    exports._NODES_REGISTRY = {};
    exports._registerNode = function (NodeClass) {
        exports._NODES_REGISTRY[NodeClass.prototype.getClassName()] = NodeClass;
        exports.Konva[NodeClass.prototype.getClassName()] = NodeClass;
    };
    });

    var Util = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    var Collection = (function () {
        function Collection() {
        }
        Collection.toCollection = function (arr) {
            var collection = new Collection(), len = arr.length, n;
            for (n = 0; n < len; n++) {
                collection.push(arr[n]);
            }
            return collection;
        };
        Collection._mapMethod = function (methodName) {
            Collection.prototype[methodName] = function () {
                var len = this.length, i;
                var args = [].slice.call(arguments);
                for (i = 0; i < len; i++) {
                    this[i][methodName].apply(this[i], args);
                }
                return this;
            };
        };
        Collection.mapMethods = function (constructor) {
            var prot = constructor.prototype;
            for (var methodName in prot) {
                Collection._mapMethod(methodName);
            }
        };
        return Collection;
    }());
    exports.Collection = Collection;
    Collection.prototype = [];
    Collection.prototype.each = function (func) {
        for (var n = 0; n < this.length; n++) {
            func(this[n], n);
        }
    };
    Collection.prototype.toArray = function () {
        var arr = [], len = this.length, n;
        for (n = 0; n < len; n++) {
            arr.push(this[n]);
        }
        return arr;
    };
    var Transform = (function () {
        function Transform(m) {
            if (m === void 0) { m = [1, 0, 0, 1, 0, 0]; }
            this.dirty = false;
            this.m = (m && m.slice()) || [1, 0, 0, 1, 0, 0];
        }
        Transform.prototype.reset = function () {
            this.m[0] = 1;
            this.m[1] = 0;
            this.m[2] = 0;
            this.m[3] = 1;
            this.m[4] = 0;
            this.m[5] = 0;
        };
        Transform.prototype.copy = function () {
            return new Transform(this.m);
        };
        Transform.prototype.copyInto = function (tr) {
            tr.m[0] = this.m[0];
            tr.m[1] = this.m[1];
            tr.m[2] = this.m[2];
            tr.m[3] = this.m[3];
            tr.m[4] = this.m[4];
            tr.m[5] = this.m[5];
        };
        Transform.prototype.point = function (point) {
            var m = this.m;
            return {
                x: m[0] * point.x + m[2] * point.y + m[4],
                y: m[1] * point.x + m[3] * point.y + m[5],
            };
        };
        Transform.prototype.translate = function (x, y) {
            this.m[4] += this.m[0] * x + this.m[2] * y;
            this.m[5] += this.m[1] * x + this.m[3] * y;
            return this;
        };
        Transform.prototype.scale = function (sx, sy) {
            this.m[0] *= sx;
            this.m[1] *= sx;
            this.m[2] *= sy;
            this.m[3] *= sy;
            return this;
        };
        Transform.prototype.rotate = function (rad) {
            var c = Math.cos(rad);
            var s = Math.sin(rad);
            var m11 = this.m[0] * c + this.m[2] * s;
            var m12 = this.m[1] * c + this.m[3] * s;
            var m21 = this.m[0] * -s + this.m[2] * c;
            var m22 = this.m[1] * -s + this.m[3] * c;
            this.m[0] = m11;
            this.m[1] = m12;
            this.m[2] = m21;
            this.m[3] = m22;
            return this;
        };
        Transform.prototype.getTranslation = function () {
            return {
                x: this.m[4],
                y: this.m[5],
            };
        };
        Transform.prototype.skew = function (sx, sy) {
            var m11 = this.m[0] + this.m[2] * sy;
            var m12 = this.m[1] + this.m[3] * sy;
            var m21 = this.m[2] + this.m[0] * sx;
            var m22 = this.m[3] + this.m[1] * sx;
            this.m[0] = m11;
            this.m[1] = m12;
            this.m[2] = m21;
            this.m[3] = m22;
            return this;
        };
        Transform.prototype.multiply = function (matrix) {
            var m11 = this.m[0] * matrix.m[0] + this.m[2] * matrix.m[1];
            var m12 = this.m[1] * matrix.m[0] + this.m[3] * matrix.m[1];
            var m21 = this.m[0] * matrix.m[2] + this.m[2] * matrix.m[3];
            var m22 = this.m[1] * matrix.m[2] + this.m[3] * matrix.m[3];
            var dx = this.m[0] * matrix.m[4] + this.m[2] * matrix.m[5] + this.m[4];
            var dy = this.m[1] * matrix.m[4] + this.m[3] * matrix.m[5] + this.m[5];
            this.m[0] = m11;
            this.m[1] = m12;
            this.m[2] = m21;
            this.m[3] = m22;
            this.m[4] = dx;
            this.m[5] = dy;
            return this;
        };
        Transform.prototype.invert = function () {
            var d = 1 / (this.m[0] * this.m[3] - this.m[1] * this.m[2]);
            var m0 = this.m[3] * d;
            var m1 = -this.m[1] * d;
            var m2 = -this.m[2] * d;
            var m3 = this.m[0] * d;
            var m4 = d * (this.m[2] * this.m[5] - this.m[3] * this.m[4]);
            var m5 = d * (this.m[1] * this.m[4] - this.m[0] * this.m[5]);
            this.m[0] = m0;
            this.m[1] = m1;
            this.m[2] = m2;
            this.m[3] = m3;
            this.m[4] = m4;
            this.m[5] = m5;
            return this;
        };
        Transform.prototype.getMatrix = function () {
            return this.m;
        };
        Transform.prototype.setAbsolutePosition = function (x, y) {
            var m0 = this.m[0], m1 = this.m[1], m2 = this.m[2], m3 = this.m[3], m4 = this.m[4], m5 = this.m[5], yt = (m0 * (y - m5) - m1 * (x - m4)) / (m0 * m3 - m1 * m2), xt = (x - m4 - m2 * yt) / m0;
            return this.translate(xt, yt);
        };
        Transform.prototype.decompose = function () {
            var a = this.m[0];
            var b = this.m[1];
            var c = this.m[2];
            var d = this.m[3];
            var e = this.m[4];
            var f = this.m[5];
            var delta = a * d - b * c;
            var result = {
                x: e,
                y: f,
                rotation: 0,
                scaleX: 0,
                scaleY: 0,
                skewX: 0,
                skewY: 0,
            };
            if (a != 0 || b != 0) {
                var r = Math.sqrt(a * a + b * b);
                result.rotation = b > 0 ? Math.acos(a / r) : -Math.acos(a / r);
                result.scaleX = r;
                result.scaleY = delta / r;
                result.skewX = (a * c + b * d) / delta;
                result.skewY = 0;
            }
            else if (c != 0 || d != 0) {
                var s = Math.sqrt(c * c + d * d);
                result.rotation =
                    Math.PI / 2 - (d > 0 ? Math.acos(-c / s) : -Math.acos(c / s));
                result.scaleX = delta / s;
                result.scaleY = s;
                result.skewX = 0;
                result.skewY = (a * c + b * d) / delta;
            }
            else ;
            result.rotation = exports.Util._getRotation(result.rotation);
            return result;
        };
        return Transform;
    }());
    exports.Transform = Transform;
    var OBJECT_ARRAY = '[object Array]', OBJECT_NUMBER = '[object Number]', OBJECT_STRING = '[object String]', OBJECT_BOOLEAN = '[object Boolean]', PI_OVER_DEG180 = Math.PI / 180, DEG180_OVER_PI = 180 / Math.PI, HASH = '#', EMPTY_STRING = '', ZERO = '0', KONVA_WARNING = 'Konva warning: ', KONVA_ERROR = 'Konva error: ', RGB_PAREN = 'rgb(', COLORS = {
        aliceblue: [240, 248, 255],
        antiquewhite: [250, 235, 215],
        aqua: [0, 255, 255],
        aquamarine: [127, 255, 212],
        azure: [240, 255, 255],
        beige: [245, 245, 220],
        bisque: [255, 228, 196],
        black: [0, 0, 0],
        blanchedalmond: [255, 235, 205],
        blue: [0, 0, 255],
        blueviolet: [138, 43, 226],
        brown: [165, 42, 42],
        burlywood: [222, 184, 135],
        cadetblue: [95, 158, 160],
        chartreuse: [127, 255, 0],
        chocolate: [210, 105, 30],
        coral: [255, 127, 80],
        cornflowerblue: [100, 149, 237],
        cornsilk: [255, 248, 220],
        crimson: [220, 20, 60],
        cyan: [0, 255, 255],
        darkblue: [0, 0, 139],
        darkcyan: [0, 139, 139],
        darkgoldenrod: [184, 132, 11],
        darkgray: [169, 169, 169],
        darkgreen: [0, 100, 0],
        darkgrey: [169, 169, 169],
        darkkhaki: [189, 183, 107],
        darkmagenta: [139, 0, 139],
        darkolivegreen: [85, 107, 47],
        darkorange: [255, 140, 0],
        darkorchid: [153, 50, 204],
        darkred: [139, 0, 0],
        darksalmon: [233, 150, 122],
        darkseagreen: [143, 188, 143],
        darkslateblue: [72, 61, 139],
        darkslategray: [47, 79, 79],
        darkslategrey: [47, 79, 79],
        darkturquoise: [0, 206, 209],
        darkviolet: [148, 0, 211],
        deeppink: [255, 20, 147],
        deepskyblue: [0, 191, 255],
        dimgray: [105, 105, 105],
        dimgrey: [105, 105, 105],
        dodgerblue: [30, 144, 255],
        firebrick: [178, 34, 34],
        floralwhite: [255, 255, 240],
        forestgreen: [34, 139, 34],
        fuchsia: [255, 0, 255],
        gainsboro: [220, 220, 220],
        ghostwhite: [248, 248, 255],
        gold: [255, 215, 0],
        goldenrod: [218, 165, 32],
        gray: [128, 128, 128],
        green: [0, 128, 0],
        greenyellow: [173, 255, 47],
        grey: [128, 128, 128],
        honeydew: [240, 255, 240],
        hotpink: [255, 105, 180],
        indianred: [205, 92, 92],
        indigo: [75, 0, 130],
        ivory: [255, 255, 240],
        khaki: [240, 230, 140],
        lavender: [230, 230, 250],
        lavenderblush: [255, 240, 245],
        lawngreen: [124, 252, 0],
        lemonchiffon: [255, 250, 205],
        lightblue: [173, 216, 230],
        lightcoral: [240, 128, 128],
        lightcyan: [224, 255, 255],
        lightgoldenrodyellow: [250, 250, 210],
        lightgray: [211, 211, 211],
        lightgreen: [144, 238, 144],
        lightgrey: [211, 211, 211],
        lightpink: [255, 182, 193],
        lightsalmon: [255, 160, 122],
        lightseagreen: [32, 178, 170],
        lightskyblue: [135, 206, 250],
        lightslategray: [119, 136, 153],
        lightslategrey: [119, 136, 153],
        lightsteelblue: [176, 196, 222],
        lightyellow: [255, 255, 224],
        lime: [0, 255, 0],
        limegreen: [50, 205, 50],
        linen: [250, 240, 230],
        magenta: [255, 0, 255],
        maroon: [128, 0, 0],
        mediumaquamarine: [102, 205, 170],
        mediumblue: [0, 0, 205],
        mediumorchid: [186, 85, 211],
        mediumpurple: [147, 112, 219],
        mediumseagreen: [60, 179, 113],
        mediumslateblue: [123, 104, 238],
        mediumspringgreen: [0, 250, 154],
        mediumturquoise: [72, 209, 204],
        mediumvioletred: [199, 21, 133],
        midnightblue: [25, 25, 112],
        mintcream: [245, 255, 250],
        mistyrose: [255, 228, 225],
        moccasin: [255, 228, 181],
        navajowhite: [255, 222, 173],
        navy: [0, 0, 128],
        oldlace: [253, 245, 230],
        olive: [128, 128, 0],
        olivedrab: [107, 142, 35],
        orange: [255, 165, 0],
        orangered: [255, 69, 0],
        orchid: [218, 112, 214],
        palegoldenrod: [238, 232, 170],
        palegreen: [152, 251, 152],
        paleturquoise: [175, 238, 238],
        palevioletred: [219, 112, 147],
        papayawhip: [255, 239, 213],
        peachpuff: [255, 218, 185],
        peru: [205, 133, 63],
        pink: [255, 192, 203],
        plum: [221, 160, 203],
        powderblue: [176, 224, 230],
        purple: [128, 0, 128],
        rebeccapurple: [102, 51, 153],
        red: [255, 0, 0],
        rosybrown: [188, 143, 143],
        royalblue: [65, 105, 225],
        saddlebrown: [139, 69, 19],
        salmon: [250, 128, 114],
        sandybrown: [244, 164, 96],
        seagreen: [46, 139, 87],
        seashell: [255, 245, 238],
        sienna: [160, 82, 45],
        silver: [192, 192, 192],
        skyblue: [135, 206, 235],
        slateblue: [106, 90, 205],
        slategray: [119, 128, 144],
        slategrey: [119, 128, 144],
        snow: [255, 255, 250],
        springgreen: [0, 255, 127],
        steelblue: [70, 130, 180],
        tan: [210, 180, 140],
        teal: [0, 128, 128],
        thistle: [216, 191, 216],
        transparent: [255, 255, 255, 0],
        tomato: [255, 99, 71],
        turquoise: [64, 224, 208],
        violet: [238, 130, 238],
        wheat: [245, 222, 179],
        white: [255, 255, 255],
        whitesmoke: [245, 245, 245],
        yellow: [255, 255, 0],
        yellowgreen: [154, 205, 5],
    }, RGB_REGEX = /rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)/, animQueue = [];
    exports.Util = {
        _isElement: function (obj) {
            return !!(obj && obj.nodeType == 1);
        },
        _isFunction: function (obj) {
            return !!(obj && obj.constructor && obj.call && obj.apply);
        },
        _isPlainObject: function (obj) {
            return !!obj && obj.constructor === Object;
        },
        _isArray: function (obj) {
            return Object.prototype.toString.call(obj) === OBJECT_ARRAY;
        },
        _isNumber: function (obj) {
            return (Object.prototype.toString.call(obj) === OBJECT_NUMBER &&
                !isNaN(obj) &&
                isFinite(obj));
        },
        _isString: function (obj) {
            return Object.prototype.toString.call(obj) === OBJECT_STRING;
        },
        _isBoolean: function (obj) {
            return Object.prototype.toString.call(obj) === OBJECT_BOOLEAN;
        },
        isObject: function (val) {
            return val instanceof Object;
        },
        isValidSelector: function (selector) {
            if (typeof selector !== 'string') {
                return false;
            }
            var firstChar = selector[0];
            return (firstChar === '#' ||
                firstChar === '.' ||
                firstChar === firstChar.toUpperCase());
        },
        _sign: function (number) {
            if (number === 0) {
                return 0;
            }
            if (number > 0) {
                return 1;
            }
            else {
                return -1;
            }
        },
        requestAnimFrame: function (callback) {
            animQueue.push(callback);
            if (animQueue.length === 1) {
                requestAnimationFrame(function () {
                    var queue = animQueue;
                    animQueue = [];
                    queue.forEach(function (cb) {
                        cb();
                    });
                });
            }
        },
        createCanvasElement: function () {
            var canvas = document.createElement('canvas');
            try {
                canvas.style = canvas.style || {};
            }
            catch (e) { }
            return canvas;
        },
        createImageElement: function () {
            return document.createElement('img');
        },
        _isInDocument: function (el) {
            while ((el = el.parentNode)) {
                if (el == document) {
                    return true;
                }
            }
            return false;
        },
        _simplifyArray: function (arr) {
            var retArr = [], len = arr.length, util = exports.Util, n, val;
            for (n = 0; n < len; n++) {
                val = arr[n];
                if (util._isNumber(val)) {
                    val = Math.round(val * 1000) / 1000;
                }
                else if (!util._isString(val)) {
                    val = val.toString();
                }
                retArr.push(val);
            }
            return retArr;
        },
        _urlToImage: function (url, callback) {
            var imageObj = new Global.glob.Image();
            imageObj.onload = function () {
                callback(imageObj);
            };
            imageObj.src = url;
        },
        _rgbToHex: function (r, g, b) {
            return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        },
        _hexToRgb: function (hex) {
            hex = hex.replace(HASH, EMPTY_STRING);
            var bigint = parseInt(hex, 16);
            return {
                r: (bigint >> 16) & 255,
                g: (bigint >> 8) & 255,
                b: bigint & 255,
            };
        },
        getRandomColor: function () {
            var randColor = ((Math.random() * 0xffffff) << 0).toString(16);
            while (randColor.length < 6) {
                randColor = ZERO + randColor;
            }
            return HASH + randColor;
        },
        get: function (val, def) {
            if (val === undefined) {
                return def;
            }
            else {
                return val;
            }
        },
        getRGB: function (color) {
            var rgb;
            if (color in COLORS) {
                rgb = COLORS[color];
                return {
                    r: rgb[0],
                    g: rgb[1],
                    b: rgb[2],
                };
            }
            else if (color[0] === HASH) {
                return this._hexToRgb(color.substring(1));
            }
            else if (color.substr(0, 4) === RGB_PAREN) {
                rgb = RGB_REGEX.exec(color.replace(/ /g, ''));
                return {
                    r: parseInt(rgb[1], 10),
                    g: parseInt(rgb[2], 10),
                    b: parseInt(rgb[3], 10),
                };
            }
            else {
                return {
                    r: 0,
                    g: 0,
                    b: 0,
                };
            }
        },
        colorToRGBA: function (str) {
            str = str || 'black';
            return (exports.Util._namedColorToRBA(str) ||
                exports.Util._hex3ColorToRGBA(str) ||
                exports.Util._hex6ColorToRGBA(str) ||
                exports.Util._rgbColorToRGBA(str) ||
                exports.Util._rgbaColorToRGBA(str) ||
                exports.Util._hslColorToRGBA(str));
        },
        _namedColorToRBA: function (str) {
            var c = COLORS[str.toLowerCase()];
            if (!c) {
                return null;
            }
            return {
                r: c[0],
                g: c[1],
                b: c[2],
                a: 1,
            };
        },
        _rgbColorToRGBA: function (str) {
            if (str.indexOf('rgb(') === 0) {
                str = str.match(/rgb\(([^)]+)\)/)[1];
                var parts = str.split(/ *, */).map(Number);
                return {
                    r: parts[0],
                    g: parts[1],
                    b: parts[2],
                    a: 1,
                };
            }
        },
        _rgbaColorToRGBA: function (str) {
            if (str.indexOf('rgba(') === 0) {
                str = str.match(/rgba\(([^)]+)\)/)[1];
                var parts = str.split(/ *, */).map(Number);
                return {
                    r: parts[0],
                    g: parts[1],
                    b: parts[2],
                    a: parts[3],
                };
            }
        },
        _hex6ColorToRGBA: function (str) {
            if (str[0] === '#' && str.length === 7) {
                return {
                    r: parseInt(str.slice(1, 3), 16),
                    g: parseInt(str.slice(3, 5), 16),
                    b: parseInt(str.slice(5, 7), 16),
                    a: 1,
                };
            }
        },
        _hex3ColorToRGBA: function (str) {
            if (str[0] === '#' && str.length === 4) {
                return {
                    r: parseInt(str[1] + str[1], 16),
                    g: parseInt(str[2] + str[2], 16),
                    b: parseInt(str[3] + str[3], 16),
                    a: 1,
                };
            }
        },
        _hslColorToRGBA: function (str) {
            if (/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.test(str)) {
                var _a = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(str), _ = _a[0], hsl = _a.slice(1);
                var h = Number(hsl[0]) / 360;
                var s = Number(hsl[1]) / 100;
                var l = Number(hsl[2]) / 100;
                var t2 = void 0;
                var t3 = void 0;
                var val = void 0;
                if (s === 0) {
                    val = l * 255;
                    return {
                        r: Math.round(val),
                        g: Math.round(val),
                        b: Math.round(val),
                        a: 1,
                    };
                }
                if (l < 0.5) {
                    t2 = l * (1 + s);
                }
                else {
                    t2 = l + s - l * s;
                }
                var t1 = 2 * l - t2;
                var rgb = [0, 0, 0];
                for (var i = 0; i < 3; i++) {
                    t3 = h + (1 / 3) * -(i - 1);
                    if (t3 < 0) {
                        t3++;
                    }
                    if (t3 > 1) {
                        t3--;
                    }
                    if (6 * t3 < 1) {
                        val = t1 + (t2 - t1) * 6 * t3;
                    }
                    else if (2 * t3 < 1) {
                        val = t2;
                    }
                    else if (3 * t3 < 2) {
                        val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
                    }
                    else {
                        val = t1;
                    }
                    rgb[i] = val * 255;
                }
                return {
                    r: Math.round(rgb[0]),
                    g: Math.round(rgb[1]),
                    b: Math.round(rgb[2]),
                    a: 1,
                };
            }
        },
        haveIntersection: function (r1, r2) {
            return !(r2.x > r1.x + r1.width ||
                r2.x + r2.width < r1.x ||
                r2.y > r1.y + r1.height ||
                r2.y + r2.height < r1.y);
        },
        cloneObject: function (obj) {
            var retObj = {};
            for (var key in obj) {
                if (this._isPlainObject(obj[key])) {
                    retObj[key] = this.cloneObject(obj[key]);
                }
                else if (this._isArray(obj[key])) {
                    retObj[key] = this.cloneArray(obj[key]);
                }
                else {
                    retObj[key] = obj[key];
                }
            }
            return retObj;
        },
        cloneArray: function (arr) {
            return arr.slice(0);
        },
        _degToRad: function (deg) {
            return deg * PI_OVER_DEG180;
        },
        _radToDeg: function (rad) {
            return rad * DEG180_OVER_PI;
        },
        _getRotation: function (radians) {
            return Global.Konva.angleDeg ? exports.Util._radToDeg(radians) : radians;
        },
        _capitalize: function (str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        throw: function (str) {
            throw new Error(KONVA_ERROR + str);
        },
        error: function (str) {
            console.error(KONVA_ERROR + str);
        },
        warn: function (str) {
            if (!Global.Konva.showWarnings) {
                return;
            }
            console.warn(KONVA_WARNING + str);
        },
        extend: function (child, parent) {
            function Ctor() {
                this.constructor = child;
            }
            Ctor.prototype = parent.prototype;
            var oldProto = child.prototype;
            child.prototype = new Ctor();
            for (var key in oldProto) {
                if (oldProto.hasOwnProperty(key)) {
                    child.prototype[key] = oldProto[key];
                }
            }
            child.__super__ = parent.prototype;
            child.super = parent;
        },
        _getControlPoints: function (x0, y0, x1, y1, x2, y2, t) {
            var d01 = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)), d12 = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)), fa = (t * d01) / (d01 + d12), fb = (t * d12) / (d01 + d12), p1x = x1 - fa * (x2 - x0), p1y = y1 - fa * (y2 - y0), p2x = x1 + fb * (x2 - x0), p2y = y1 + fb * (y2 - y0);
            return [p1x, p1y, p2x, p2y];
        },
        _expandPoints: function (p, tension) {
            var len = p.length, allPoints = [], n, cp;
            for (n = 2; n < len - 2; n += 2) {
                cp = exports.Util._getControlPoints(p[n - 2], p[n - 1], p[n], p[n + 1], p[n + 2], p[n + 3], tension);
                allPoints.push(cp[0]);
                allPoints.push(cp[1]);
                allPoints.push(p[n]);
                allPoints.push(p[n + 1]);
                allPoints.push(cp[2]);
                allPoints.push(cp[3]);
            }
            return allPoints;
        },
        each: function (obj, func) {
            for (var key in obj) {
                func(key, obj[key]);
            }
        },
        _inRange: function (val, left, right) {
            return left <= val && val < right;
        },
        _getProjectionToSegment: function (x1, y1, x2, y2, x3, y3) {
            var x, y, dist;
            var pd2 = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
            if (pd2 == 0) {
                x = x1;
                y = y1;
                dist = (x3 - x2) * (x3 - x2) + (y3 - y2) * (y3 - y2);
            }
            else {
                var u = ((x3 - x1) * (x2 - x1) + (y3 - y1) * (y2 - y1)) / pd2;
                if (u < 0) {
                    x = x1;
                    y = y1;
                    dist = (x1 - x3) * (x1 - x3) + (y1 - y3) * (y1 - y3);
                }
                else if (u > 1.0) {
                    x = x2;
                    y = y2;
                    dist = (x2 - x3) * (x2 - x3) + (y2 - y3) * (y2 - y3);
                }
                else {
                    x = x1 + u * (x2 - x1);
                    y = y1 + u * (y2 - y1);
                    dist = (x - x3) * (x - x3) + (y - y3) * (y - y3);
                }
            }
            return [x, y, dist];
        },
        _getProjectionToLine: function (pt, line, isClosed) {
            var pc = exports.Util.cloneObject(pt);
            var dist = Number.MAX_VALUE;
            line.forEach(function (p1, i) {
                if (!isClosed && i === line.length - 1) {
                    return;
                }
                var p2 = line[(i + 1) % line.length];
                var proj = exports.Util._getProjectionToSegment(p1.x, p1.y, p2.x, p2.y, pt.x, pt.y);
                var px = proj[0], py = proj[1], pdist = proj[2];
                if (pdist < dist) {
                    pc.x = px;
                    pc.y = py;
                    dist = pdist;
                }
            });
            return pc;
        },
        _prepareArrayForTween: function (startArray, endArray, isClosed) {
            var n, start = [], end = [];
            if (startArray.length > endArray.length) {
                var temp = endArray;
                endArray = startArray;
                startArray = temp;
            }
            for (n = 0; n < startArray.length; n += 2) {
                start.push({
                    x: startArray[n],
                    y: startArray[n + 1],
                });
            }
            for (n = 0; n < endArray.length; n += 2) {
                end.push({
                    x: endArray[n],
                    y: endArray[n + 1],
                });
            }
            var newStart = [];
            end.forEach(function (point) {
                var pr = exports.Util._getProjectionToLine(point, start, isClosed);
                newStart.push(pr.x);
                newStart.push(pr.y);
            });
            return newStart;
        },
        _prepareToStringify: function (obj) {
            var desc;
            obj.visitedByCircularReferenceRemoval = true;
            for (var key in obj) {
                if (!(obj.hasOwnProperty(key) && obj[key] && typeof obj[key] == 'object')) {
                    continue;
                }
                desc = Object.getOwnPropertyDescriptor(obj, key);
                if (obj[key].visitedByCircularReferenceRemoval ||
                    exports.Util._isElement(obj[key])) {
                    if (desc.configurable) {
                        delete obj[key];
                    }
                    else {
                        return null;
                    }
                }
                else if (exports.Util._prepareToStringify(obj[key]) === null) {
                    if (desc.configurable) {
                        delete obj[key];
                    }
                    else {
                        return null;
                    }
                }
            }
            delete obj.visitedByCircularReferenceRemoval;
            return obj;
        },
        _assign: function (target, source) {
            for (var key in source) {
                target[key] = source[key];
            }
            return target;
        },
        _getFirstPointerId: function (evt) {
            if (!evt.touches) {
                return 999;
            }
            else {
                return evt.changedTouches[0].identifier;
            }
        },
    };
    });

    var Validators = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });


    function _formatValue(val) {
        if (Util.Util._isString(val)) {
            return '"' + val + '"';
        }
        if (Object.prototype.toString.call(val) === '[object Number]') {
            return val;
        }
        if (Util.Util._isBoolean(val)) {
            return val;
        }
        return Object.prototype.toString.call(val);
    }
    function RGBComponent(val) {
        if (val > 255) {
            return 255;
        }
        else if (val < 0) {
            return 0;
        }
        return Math.round(val);
    }
    exports.RGBComponent = RGBComponent;
    function alphaComponent(val) {
        if (val > 1) {
            return 1;
        }
        else if (val < 0.0001) {
            return 0.0001;
        }
        return val;
    }
    exports.alphaComponent = alphaComponent;
    function getNumberValidator() {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                if (!Util.Util._isNumber(val)) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a number.');
                }
                return val;
            };
        }
    }
    exports.getNumberValidator = getNumberValidator;
    function getNumberOrArrayOfNumbersValidator(noOfElements) {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                var isNumber = Util.Util._isNumber(val);
                var isValidArray = Util.Util._isArray(val) && val.length == noOfElements;
                if (!isNumber && !isValidArray) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a number or Array<number>(' + noOfElements + ')');
                }
                return val;
            };
        }
    }
    exports.getNumberOrArrayOfNumbersValidator = getNumberOrArrayOfNumbersValidator;
    function getNumberOrAutoValidator() {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                var isNumber = Util.Util._isNumber(val);
                var isAuto = val === 'auto';
                if (!(isNumber || isAuto)) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a number or "auto".');
                }
                return val;
            };
        }
    }
    exports.getNumberOrAutoValidator = getNumberOrAutoValidator;
    function getStringValidator() {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                if (!Util.Util._isString(val)) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a string.');
                }
                return val;
            };
        }
    }
    exports.getStringValidator = getStringValidator;
    function getStringOrGradientValidator() {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                var isString = Util.Util._isString(val);
                var isGradient = Object.prototype.toString.call(val) === '[object CanvasGradient]';
                if (!(isString || isGradient)) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a string or a native gradient.');
                }
                return val;
            };
        }
    }
    exports.getStringOrGradientValidator = getStringOrGradientValidator;
    function getFunctionValidator() {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                if (!Util.Util._isFunction(val)) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a function.');
                }
                return val;
            };
        }
    }
    exports.getFunctionValidator = getFunctionValidator;
    function getNumberArrayValidator() {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                if (!Util.Util._isArray(val)) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a array of numbers.');
                }
                else {
                    val.forEach(function (item) {
                        if (!Util.Util._isNumber(item)) {
                            Util.Util.warn('"' +
                                attr +
                                '" attribute has non numeric element ' +
                                item +
                                '. Make sure that all elements are numbers.');
                        }
                    });
                }
                return val;
            };
        }
    }
    exports.getNumberArrayValidator = getNumberArrayValidator;
    function getBooleanValidator() {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                var isBool = val === true || val === false;
                if (!isBool) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be a boolean.');
                }
                return val;
            };
        }
    }
    exports.getBooleanValidator = getBooleanValidator;
    function getComponentValidator(components) {
        if (Global.Konva.isUnminified) {
            return function (val, attr) {
                if (!Util.Util.isObject(val)) {
                    Util.Util.warn(_formatValue(val) +
                        ' is a not valid value for "' +
                        attr +
                        '" attribute. The value should be an object with properties ' +
                        components);
                }
                return val;
            };
        }
    }
    exports.getComponentValidator = getComponentValidator;
    });

    var Factory = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });


    var GET = 'get', SET = 'set';
    exports.Factory = {
        addGetterSetter: function (constructor, attr, def, validator, after) {
            exports.Factory.addGetter(constructor, attr, def);
            exports.Factory.addSetter(constructor, attr, validator, after);
            exports.Factory.addOverloadedGetterSetter(constructor, attr);
        },
        addGetter: function (constructor, attr, def) {
            var method = GET + Util.Util._capitalize(attr);
            constructor.prototype[method] =
                constructor.prototype[method] ||
                    function () {
                        var val = this.attrs[attr];
                        return val === undefined ? def : val;
                    };
        },
        addSetter: function (constructor, attr, validator, after) {
            var method = SET + Util.Util._capitalize(attr);
            if (!constructor.prototype[method]) {
                exports.Factory.overWriteSetter(constructor, attr, validator, after);
            }
        },
        overWriteSetter: function (constructor, attr, validator, after) {
            var method = SET + Util.Util._capitalize(attr);
            constructor.prototype[method] = function (val) {
                if (validator && val !== undefined && val !== null) {
                    val = validator.call(this, val, attr);
                }
                this._setAttr(attr, val);
                if (after) {
                    after.call(this);
                }
                return this;
            };
        },
        addComponentsGetterSetter: function (constructor, attr, components, validator, after) {
            var len = components.length, capitalize = Util.Util._capitalize, getter = GET + capitalize(attr), setter = SET + capitalize(attr), n, component;
            constructor.prototype[getter] = function () {
                var ret = {};
                for (n = 0; n < len; n++) {
                    component = components[n];
                    ret[component] = this.getAttr(attr + capitalize(component));
                }
                return ret;
            };
            var basicValidator = Validators.getComponentValidator(components);
            constructor.prototype[setter] = function (val) {
                var oldVal = this.attrs[attr], key;
                if (validator) {
                    val = validator.call(this, val);
                }
                if (basicValidator) {
                    basicValidator.call(this, val, attr);
                }
                for (key in val) {
                    if (!val.hasOwnProperty(key)) {
                        continue;
                    }
                    this._setAttr(attr + capitalize(key), val[key]);
                }
                this._fireChangeEvent(attr, oldVal, val);
                if (after) {
                    after.call(this);
                }
                return this;
            };
            exports.Factory.addOverloadedGetterSetter(constructor, attr);
        },
        addOverloadedGetterSetter: function (constructor, attr) {
            var capitalizedAttr = Util.Util._capitalize(attr), setter = SET + capitalizedAttr, getter = GET + capitalizedAttr;
            constructor.prototype[attr] = function () {
                if (arguments.length) {
                    this[setter](arguments[0]);
                    return this;
                }
                return this[getter]();
            };
        },
        addDeprecatedGetterSetter: function (constructor, attr, def, validator) {
            Util.Util.error('Adding deprecated ' + attr);
            var method = GET + Util.Util._capitalize(attr);
            var message = attr +
                ' property is deprecated and will be removed soon. Look at Konva change log for more information.';
            constructor.prototype[method] = function () {
                Util.Util.error(message);
                var val = this.attrs[attr];
                return val === undefined ? def : val;
            };
            exports.Factory.addSetter(constructor, attr, validator, function () {
                Util.Util.error(message);
            });
            exports.Factory.addOverloadedGetterSetter(constructor, attr);
        },
        backCompat: function (constructor, methods) {
            Util.Util.each(methods, function (oldMethodName, newMethodName) {
                var method = constructor.prototype[newMethodName];
                var oldGetter = GET + Util.Util._capitalize(oldMethodName);
                var oldSetter = SET + Util.Util._capitalize(oldMethodName);
                function deprecated() {
                    method.apply(this, arguments);
                    Util.Util.error('"' +
                        oldMethodName +
                        '" method is deprecated and will be removed soon. Use ""' +
                        newMethodName +
                        '" instead.');
                }
                constructor.prototype[oldMethodName] = deprecated;
                constructor.prototype[oldGetter] = deprecated;
                constructor.prototype[oldSetter] = deprecated;
            });
        },
        afterSetFilter: function () {
            this._filterUpToDate = false;
        },
    };
    });

    var Context_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });


    var COMMA = ',', OPEN_PAREN = '(', CLOSE_PAREN = ')', OPEN_PAREN_BRACKET = '([', CLOSE_BRACKET_PAREN = '])', SEMICOLON = ';', DOUBLE_PAREN = '()', EQUALS = '=', CONTEXT_METHODS = [
        'arc',
        'arcTo',
        'beginPath',
        'bezierCurveTo',
        'clearRect',
        'clip',
        'closePath',
        'createLinearGradient',
        'createPattern',
        'createRadialGradient',
        'drawImage',
        'ellipse',
        'fill',
        'fillText',
        'getImageData',
        'createImageData',
        'lineTo',
        'moveTo',
        'putImageData',
        'quadraticCurveTo',
        'rect',
        'restore',
        'rotate',
        'save',
        'scale',
        'setLineDash',
        'setTransform',
        'stroke',
        'strokeText',
        'transform',
        'translate',
    ];
    var CONTEXT_PROPERTIES = [
        'fillStyle',
        'strokeStyle',
        'shadowColor',
        'shadowBlur',
        'shadowOffsetX',
        'shadowOffsetY',
        'lineCap',
        'lineDashOffset',
        'lineJoin',
        'lineWidth',
        'miterLimit',
        'font',
        'textAlign',
        'textBaseline',
        'globalAlpha',
        'globalCompositeOperation',
        'imageSmoothingEnabled',
    ];
    var traceArrMax = 100;
    var Context = (function () {
        function Context(canvas) {
            this.canvas = canvas;
            this._context = canvas._canvas.getContext('2d');
            if (Global.Konva.enableTrace) {
                this.traceArr = [];
                this._enableTrace();
            }
        }
        Context.prototype.fillShape = function (shape) {
            if (shape.fillEnabled()) {
                this._fill(shape);
            }
        };
        Context.prototype._fill = function (shape) {
        };
        Context.prototype.strokeShape = function (shape) {
            if (shape.hasStroke()) {
                this._stroke(shape);
            }
        };
        Context.prototype._stroke = function (shape) {
        };
        Context.prototype.fillStrokeShape = function (shape) {
            this.fillShape(shape);
            this.strokeShape(shape);
        };
        Context.prototype.getTrace = function (relaxed) {
            var traceArr = this.traceArr, len = traceArr.length, str = '', n, trace, method, args;
            for (n = 0; n < len; n++) {
                trace = traceArr[n];
                method = trace.method;
                if (method) {
                    args = trace.args;
                    str += method;
                    if (relaxed) {
                        str += DOUBLE_PAREN;
                    }
                    else {
                        if (Util.Util._isArray(args[0])) {
                            str += OPEN_PAREN_BRACKET + args.join(COMMA) + CLOSE_BRACKET_PAREN;
                        }
                        else {
                            str += OPEN_PAREN + args.join(COMMA) + CLOSE_PAREN;
                        }
                    }
                }
                else {
                    str += trace.property;
                    if (!relaxed) {
                        str += EQUALS + trace.val;
                    }
                }
                str += SEMICOLON;
            }
            return str;
        };
        Context.prototype.clearTrace = function () {
            this.traceArr = [];
        };
        Context.prototype._trace = function (str) {
            var traceArr = this.traceArr, len;
            traceArr.push(str);
            len = traceArr.length;
            if (len >= traceArrMax) {
                traceArr.shift();
            }
        };
        Context.prototype.reset = function () {
            var pixelRatio = this.getCanvas().getPixelRatio();
            this.setTransform(1 * pixelRatio, 0, 0, 1 * pixelRatio, 0, 0);
        };
        Context.prototype.getCanvas = function () {
            return this.canvas;
        };
        Context.prototype.clear = function (bounds) {
            var canvas = this.getCanvas();
            if (bounds) {
                this.clearRect(bounds.x || 0, bounds.y || 0, bounds.width || 0, bounds.height || 0);
            }
            else {
                this.clearRect(0, 0, canvas.getWidth() / canvas.pixelRatio, canvas.getHeight() / canvas.pixelRatio);
            }
        };
        Context.prototype._applyLineCap = function (shape) {
            var lineCap = shape.getLineCap();
            if (lineCap) {
                this.setAttr('lineCap', lineCap);
            }
        };
        Context.prototype._applyOpacity = function (shape) {
            var absOpacity = shape.getAbsoluteOpacity();
            if (absOpacity !== 1) {
                this.setAttr('globalAlpha', absOpacity);
            }
        };
        Context.prototype._applyLineJoin = function (shape) {
            var lineJoin = shape.attrs.lineJoin;
            if (lineJoin) {
                this.setAttr('lineJoin', lineJoin);
            }
        };
        Context.prototype.setAttr = function (attr, val) {
            this._context[attr] = val;
        };
        Context.prototype.arc = function (a0, a1, a2, a3, a4, a5) {
            this._context.arc(a0, a1, a2, a3, a4, a5);
        };
        Context.prototype.arcTo = function (a0, a1, a2, a3, a4) {
            this._context.arcTo(a0, a1, a2, a3, a4);
        };
        Context.prototype.beginPath = function () {
            this._context.beginPath();
        };
        Context.prototype.bezierCurveTo = function (a0, a1, a2, a3, a4, a5) {
            this._context.bezierCurveTo(a0, a1, a2, a3, a4, a5);
        };
        Context.prototype.clearRect = function (a0, a1, a2, a3) {
            this._context.clearRect(a0, a1, a2, a3);
        };
        Context.prototype.clip = function () {
            this._context.clip();
        };
        Context.prototype.closePath = function () {
            this._context.closePath();
        };
        Context.prototype.createImageData = function (a0, a1) {
            var a = arguments;
            if (a.length === 2) {
                return this._context.createImageData(a0, a1);
            }
            else if (a.length === 1) {
                return this._context.createImageData(a0);
            }
        };
        Context.prototype.createLinearGradient = function (a0, a1, a2, a3) {
            return this._context.createLinearGradient(a0, a1, a2, a3);
        };
        Context.prototype.createPattern = function (a0, a1) {
            return this._context.createPattern(a0, a1);
        };
        Context.prototype.createRadialGradient = function (a0, a1, a2, a3, a4, a5) {
            return this._context.createRadialGradient(a0, a1, a2, a3, a4, a5);
        };
        Context.prototype.drawImage = function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            var a = arguments, _context = this._context;
            if (a.length === 3) {
                _context.drawImage(a0, a1, a2);
            }
            else if (a.length === 5) {
                _context.drawImage(a0, a1, a2, a3, a4);
            }
            else if (a.length === 9) {
                _context.drawImage(a0, a1, a2, a3, a4, a5, a6, a7, a8);
            }
        };
        Context.prototype.ellipse = function (a0, a1, a2, a3, a4, a5, a6, a7) {
            this._context.ellipse(a0, a1, a2, a3, a4, a5, a6, a7);
        };
        Context.prototype.isPointInPath = function (x, y) {
            return this._context.isPointInPath(x, y);
        };
        Context.prototype.fill = function () {
            this._context.fill();
        };
        Context.prototype.fillRect = function (x, y, width, height) {
            this._context.fillRect(x, y, width, height);
        };
        Context.prototype.strokeRect = function (x, y, width, height) {
            this._context.strokeRect(x, y, width, height);
        };
        Context.prototype.fillText = function (a0, a1, a2) {
            this._context.fillText(a0, a1, a2);
        };
        Context.prototype.measureText = function (text) {
            return this._context.measureText(text);
        };
        Context.prototype.getImageData = function (a0, a1, a2, a3) {
            return this._context.getImageData(a0, a1, a2, a3);
        };
        Context.prototype.lineTo = function (a0, a1) {
            this._context.lineTo(a0, a1);
        };
        Context.prototype.moveTo = function (a0, a1) {
            this._context.moveTo(a0, a1);
        };
        Context.prototype.rect = function (a0, a1, a2, a3) {
            this._context.rect(a0, a1, a2, a3);
        };
        Context.prototype.putImageData = function (a0, a1, a2) {
            this._context.putImageData(a0, a1, a2);
        };
        Context.prototype.quadraticCurveTo = function (a0, a1, a2, a3) {
            this._context.quadraticCurveTo(a0, a1, a2, a3);
        };
        Context.prototype.restore = function () {
            this._context.restore();
        };
        Context.prototype.rotate = function (a0) {
            this._context.rotate(a0);
        };
        Context.prototype.save = function () {
            this._context.save();
        };
        Context.prototype.scale = function (a0, a1) {
            this._context.scale(a0, a1);
        };
        Context.prototype.setLineDash = function (a0) {
            if (this._context.setLineDash) {
                this._context.setLineDash(a0);
            }
            else if ('mozDash' in this._context) {
                this._context['mozDash'] = a0;
            }
            else if ('webkitLineDash' in this._context) {
                this._context['webkitLineDash'] = a0;
            }
        };
        Context.prototype.getLineDash = function () {
            return this._context.getLineDash();
        };
        Context.prototype.setTransform = function (a0, a1, a2, a3, a4, a5) {
            this._context.setTransform(a0, a1, a2, a3, a4, a5);
        };
        Context.prototype.stroke = function () {
            this._context.stroke();
        };
        Context.prototype.strokeText = function (a0, a1, a2, a3) {
            this._context.strokeText(a0, a1, a2, a3);
        };
        Context.prototype.transform = function (a0, a1, a2, a3, a4, a5) {
            this._context.transform(a0, a1, a2, a3, a4, a5);
        };
        Context.prototype.translate = function (a0, a1) {
            this._context.translate(a0, a1);
        };
        Context.prototype._enableTrace = function () {
            var that = this, len = CONTEXT_METHODS.length, _simplifyArray = Util.Util._simplifyArray, origSetter = this.setAttr, n, args;
            var func = function (methodName) {
                var origMethod = that[methodName], ret;
                that[methodName] = function () {
                    args = _simplifyArray(Array.prototype.slice.call(arguments, 0));
                    ret = origMethod.apply(that, arguments);
                    that._trace({
                        method: methodName,
                        args: args,
                    });
                    return ret;
                };
            };
            for (n = 0; n < len; n++) {
                func(CONTEXT_METHODS[n]);
            }
            that.setAttr = function () {
                origSetter.apply(that, arguments);
                var prop = arguments[0];
                var val = arguments[1];
                if (prop === 'shadowOffsetX' ||
                    prop === 'shadowOffsetY' ||
                    prop === 'shadowBlur') {
                    val = val / this.canvas.getPixelRatio();
                }
                that._trace({
                    property: prop,
                    val: val,
                });
            };
        };
        Context.prototype._applyGlobalCompositeOperation = function (node) {
            var globalCompositeOperation = node.getGlobalCompositeOperation();
            if (globalCompositeOperation !== 'source-over') {
                this.setAttr('globalCompositeOperation', globalCompositeOperation);
            }
        };
        return Context;
    }());
    exports.Context = Context;
    CONTEXT_PROPERTIES.forEach(function (prop) {
        Object.defineProperty(Context.prototype, prop, {
            get: function () {
                return this._context[prop];
            },
            set: function (val) {
                this._context[prop] = val;
            },
        });
    });
    var SceneContext = (function (_super) {
        __extends(SceneContext, _super);
        function SceneContext() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        SceneContext.prototype._fillColor = function (shape) {
            var fill = shape.fill();
            this.setAttr('fillStyle', fill);
            shape._fillFunc(this);
        };
        SceneContext.prototype._fillPattern = function (shape) {
            var fillPatternX = shape.getFillPatternX(), fillPatternY = shape.getFillPatternY(), fillPatternRotation = Global.Konva.getAngle(shape.getFillPatternRotation()), fillPatternOffsetX = shape.getFillPatternOffsetX(), fillPatternOffsetY = shape.getFillPatternOffsetY(), fillPatternScaleX = shape.getFillPatternScaleX(), fillPatternScaleY = shape.getFillPatternScaleY();
            if (fillPatternX || fillPatternY) {
                this.translate(fillPatternX || 0, fillPatternY || 0);
            }
            if (fillPatternRotation) {
                this.rotate(fillPatternRotation);
            }
            if (fillPatternOffsetX || fillPatternOffsetY) {
                this.translate(-1 * fillPatternOffsetX, -1 * fillPatternOffsetY);
            }
            this.setAttr('fillStyle', shape._getFillPattern());
            shape._fillFunc(this);
        };
        SceneContext.prototype._fillLinearGradient = function (shape) {
            var grd = shape._getLinearGradient();
            if (grd) {
                this.setAttr('fillStyle', grd);
                shape._fillFunc(this);
            }
        };
        SceneContext.prototype._fillRadialGradient = function (shape) {
            var grd = shape._getRadialGradient();
            if (grd) {
                this.setAttr('fillStyle', grd);
                shape._fillFunc(this);
            }
        };
        SceneContext.prototype._fill = function (shape) {
            var hasColor = shape.fill(), fillPriority = shape.getFillPriority();
            if (hasColor && fillPriority === 'color') {
                this._fillColor(shape);
                return;
            }
            var hasPattern = shape.getFillPatternImage();
            if (hasPattern && fillPriority === 'pattern') {
                this._fillPattern(shape);
                return;
            }
            var hasLinearGradient = shape.getFillLinearGradientColorStops();
            if (hasLinearGradient && fillPriority === 'linear-gradient') {
                this._fillLinearGradient(shape);
                return;
            }
            var hasRadialGradient = shape.getFillRadialGradientColorStops();
            if (hasRadialGradient && fillPriority === 'radial-gradient') {
                this._fillRadialGradient(shape);
                return;
            }
            if (hasColor) {
                this._fillColor(shape);
            }
            else if (hasPattern) {
                this._fillPattern(shape);
            }
            else if (hasLinearGradient) {
                this._fillLinearGradient(shape);
            }
            else if (hasRadialGradient) {
                this._fillRadialGradient(shape);
            }
        };
        SceneContext.prototype._strokeLinearGradient = function (shape) {
            var start = shape.getStrokeLinearGradientStartPoint(), end = shape.getStrokeLinearGradientEndPoint(), colorStops = shape.getStrokeLinearGradientColorStops(), grd = this.createLinearGradient(start.x, start.y, end.x, end.y);
            if (colorStops) {
                for (var n = 0; n < colorStops.length; n += 2) {
                    grd.addColorStop(colorStops[n], colorStops[n + 1]);
                }
                this.setAttr('strokeStyle', grd);
            }
        };
        SceneContext.prototype._stroke = function (shape) {
            var dash = shape.dash(), strokeScaleEnabled = shape.getStrokeScaleEnabled();
            if (shape.hasStroke()) {
                if (!strokeScaleEnabled) {
                    this.save();
                    var pixelRatio = this.getCanvas().getPixelRatio();
                    this.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
                }
                this._applyLineCap(shape);
                if (dash && shape.dashEnabled()) {
                    this.setLineDash(dash);
                    this.setAttr('lineDashOffset', shape.dashOffset());
                }
                this.setAttr('lineWidth', shape.strokeWidth());
                if (!shape.getShadowForStrokeEnabled()) {
                    this.setAttr('shadowColor', 'rgba(0,0,0,0)');
                }
                var hasLinearGradient = shape.getStrokeLinearGradientColorStops();
                if (hasLinearGradient) {
                    this._strokeLinearGradient(shape);
                }
                else {
                    this.setAttr('strokeStyle', shape.stroke());
                }
                shape._strokeFunc(this);
                if (!strokeScaleEnabled) {
                    this.restore();
                }
            }
        };
        SceneContext.prototype._applyShadow = function (shape) {
            var util = Util.Util, color = util.get(shape.getShadowRGBA(), 'black'), blur = util.get(shape.getShadowBlur(), 5), offset = util.get(shape.getShadowOffset(), {
                x: 0,
                y: 0,
            }), scale = shape.getAbsoluteScale(), ratio = this.canvas.getPixelRatio(), scaleX = scale.x * ratio, scaleY = scale.y * ratio;
            this.setAttr('shadowColor', color);
            this.setAttr('shadowBlur', blur * Math.min(Math.abs(scaleX), Math.abs(scaleY)));
            this.setAttr('shadowOffsetX', offset.x * scaleX);
            this.setAttr('shadowOffsetY', offset.y * scaleY);
        };
        return SceneContext;
    }(Context));
    exports.SceneContext = SceneContext;
    var HitContext = (function (_super) {
        __extends(HitContext, _super);
        function HitContext() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        HitContext.prototype._fill = function (shape) {
            this.save();
            this.setAttr('fillStyle', shape.colorKey);
            shape._fillFuncHit(this);
            this.restore();
        };
        HitContext.prototype.strokeShape = function (shape) {
            if (shape.hasHitStroke()) {
                this._stroke(shape);
            }
        };
        HitContext.prototype._stroke = function (shape) {
            if (shape.hasHitStroke()) {
                var strokeScaleEnabled = shape.getStrokeScaleEnabled();
                if (!strokeScaleEnabled) {
                    this.save();
                    var pixelRatio = this.getCanvas().getPixelRatio();
                    this.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
                }
                this._applyLineCap(shape);
                var hitStrokeWidth = shape.hitStrokeWidth();
                var strokeWidth = hitStrokeWidth === 'auto' ? shape.strokeWidth() : hitStrokeWidth;
                this.setAttr('lineWidth', strokeWidth);
                this.setAttr('strokeStyle', shape.colorKey);
                shape._strokeFuncHit(this);
                if (!strokeScaleEnabled) {
                    this.restore();
                }
            }
        };
        return HitContext;
    }(Context));
    exports.HitContext = HitContext;
    });

    var Canvas_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var _pixelRatio;
    function getDevicePixelRatio() {
        if (_pixelRatio) {
            return _pixelRatio;
        }
        var canvas = Util.Util.createCanvasElement();
        var context = canvas.getContext('2d');
        _pixelRatio = (function () {
            var devicePixelRatio = Global.Konva._global.devicePixelRatio || 1, backingStoreRatio = context.webkitBackingStorePixelRatio ||
                context.mozBackingStorePixelRatio ||
                context.msBackingStorePixelRatio ||
                context.oBackingStorePixelRatio ||
                context.backingStorePixelRatio ||
                1;
            return devicePixelRatio / backingStoreRatio;
        })();
        return _pixelRatio;
    }
    var Canvas = (function () {
        function Canvas(config) {
            this.pixelRatio = 1;
            this.width = 0;
            this.height = 0;
            this.isCache = false;
            var conf = config || {};
            var pixelRatio = conf.pixelRatio || Global.Konva.pixelRatio || getDevicePixelRatio();
            this.pixelRatio = pixelRatio;
            this._canvas = Util.Util.createCanvasElement();
            this._canvas.style.padding = '0';
            this._canvas.style.margin = '0';
            this._canvas.style.border = '0';
            this._canvas.style.background = 'transparent';
            this._canvas.style.position = 'absolute';
            this._canvas.style.top = '0';
            this._canvas.style.left = '0';
        }
        Canvas.prototype.getContext = function () {
            return this.context;
        };
        Canvas.prototype.getPixelRatio = function () {
            return this.pixelRatio;
        };
        Canvas.prototype.setPixelRatio = function (pixelRatio) {
            var previousRatio = this.pixelRatio;
            this.pixelRatio = pixelRatio;
            this.setSize(this.getWidth() / previousRatio, this.getHeight() / previousRatio);
        };
        Canvas.prototype.setWidth = function (width) {
            this.width = this._canvas.width = width * this.pixelRatio;
            this._canvas.style.width = width + 'px';
            var pixelRatio = this.pixelRatio, _context = this.getContext()._context;
            _context.scale(pixelRatio, pixelRatio);
        };
        Canvas.prototype.setHeight = function (height) {
            this.height = this._canvas.height = height * this.pixelRatio;
            this._canvas.style.height = height + 'px';
            var pixelRatio = this.pixelRatio, _context = this.getContext()._context;
            _context.scale(pixelRatio, pixelRatio);
        };
        Canvas.prototype.getWidth = function () {
            return this.width;
        };
        Canvas.prototype.getHeight = function () {
            return this.height;
        };
        Canvas.prototype.setSize = function (width, height) {
            this.setWidth(width || 0);
            this.setHeight(height || 0);
        };
        Canvas.prototype.toDataURL = function (mimeType, quality) {
            try {
                return this._canvas.toDataURL(mimeType, quality);
            }
            catch (e) {
                try {
                    return this._canvas.toDataURL();
                }
                catch (err) {
                    Util.Util.error('Unable to get data URL. ' +
                        err.message +
                        ' For more info read https://konvajs.org/docs/posts/Tainted_Canvas.html.');
                    return '';
                }
            }
        };
        return Canvas;
    }());
    exports.Canvas = Canvas;
    Factory.Factory.addGetterSetter(Canvas, 'pixelRatio', undefined, Validators.getNumberValidator());
    var SceneCanvas = (function (_super) {
        __extends(SceneCanvas, _super);
        function SceneCanvas(config) {
            if (config === void 0) { config = { width: 0, height: 0 }; }
            var _this = _super.call(this, config) || this;
            _this.context = new Context_1.SceneContext(_this);
            _this.setSize(config.width, config.height);
            return _this;
        }
        return SceneCanvas;
    }(Canvas));
    exports.SceneCanvas = SceneCanvas;
    var HitCanvas = (function (_super) {
        __extends(HitCanvas, _super);
        function HitCanvas(config) {
            if (config === void 0) { config = { width: 0, height: 0 }; }
            var _this = _super.call(this, config) || this;
            _this.hitCanvas = true;
            _this.context = new Context_1.HitContext(_this);
            _this.setSize(config.width, config.height);
            return _this;
        }
        return HitCanvas;
    }(Canvas));
    exports.HitCanvas = HitCanvas;
    });

    var DragAndDrop = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });


    exports.DD = {
        get isDragging() {
            var flag = false;
            exports.DD._dragElements.forEach(function (elem) {
                if (elem.dragStatus === 'dragging') {
                    flag = true;
                }
            });
            return flag;
        },
        justDragged: false,
        get node() {
            var node;
            exports.DD._dragElements.forEach(function (elem) {
                node = elem.node;
            });
            return node;
        },
        _dragElements: new Map(),
        _drag: function (evt) {
            var nodesToFireEvents = [];
            exports.DD._dragElements.forEach(function (elem, key) {
                var node = elem.node;
                var stage = node.getStage();
                stage.setPointersPositions(evt);
                if (elem.pointerId === undefined) {
                    elem.pointerId = Util.Util._getFirstPointerId(evt);
                }
                var pos = stage._changedPointerPositions.find(function (pos) { return pos.id === elem.pointerId; });
                if (!pos) {
                    return;
                }
                if (elem.dragStatus !== 'dragging') {
                    var dragDistance = node.dragDistance();
                    var distance = Math.max(Math.abs(pos.x - elem.startPointerPos.x), Math.abs(pos.y - elem.startPointerPos.y));
                    if (distance < dragDistance) {
                        return;
                    }
                    node.startDrag({ evt: evt });
                    if (!node.isDragging()) {
                        return;
                    }
                }
                node._setDragPosition(evt, elem);
                nodesToFireEvents.push(node);
            });
            nodesToFireEvents.forEach(function (node) {
                node.fire('dragmove', {
                    type: 'dragmove',
                    target: node,
                    evt: evt,
                }, true);
            });
        },
        _endDragBefore: function (evt) {
            exports.DD._dragElements.forEach(function (elem, key) {
                var node = elem.node;
                var stage = node.getStage();
                if (evt) {
                    stage.setPointersPositions(evt);
                }
                var pos = stage._changedPointerPositions.find(function (pos) { return pos.id === elem.pointerId; });
                if (!pos) {
                    return;
                }
                if (elem.dragStatus === 'dragging' || elem.dragStatus === 'stopped') {
                    exports.DD.justDragged = true;
                    Global.Konva.listenClickTap = false;
                    elem.dragStatus = 'stopped';
                }
                var drawNode = elem.node.getLayer() ||
                    (elem.node instanceof Global.Konva['Stage'] && elem.node);
                if (drawNode) {
                    drawNode.draw();
                }
            });
        },
        _endDragAfter: function (evt) {
            exports.DD._dragElements.forEach(function (elem, key) {
                if (elem.dragStatus === 'stopped') {
                    elem.node.fire('dragend', {
                        type: 'dragend',
                        target: elem.node,
                        evt: evt,
                    }, true);
                }
                if (elem.dragStatus !== 'dragging') {
                    exports.DD._dragElements.delete(key);
                }
            });
        },
    };
    if (Global.Konva.isBrowser) {
        window.addEventListener('mouseup', exports.DD._endDragBefore, true);
        window.addEventListener('touchend', exports.DD._endDragBefore, true);
        window.addEventListener('mousemove', exports.DD._drag);
        window.addEventListener('touchmove', exports.DD._drag);
        window.addEventListener('mouseup', exports.DD._endDragAfter, false);
        window.addEventListener('touchend', exports.DD._endDragAfter, false);
    }
    });

    var Node_1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });






    exports.ids = {};
    exports.names = {};
    var _addId = function (node, id) {
        if (!id) {
            return;
        }
        exports.ids[id] = node;
    };
    exports._removeId = function (id, node) {
        if (!id) {
            return;
        }
        if (exports.ids[id] !== node) {
            return;
        }
        delete exports.ids[id];
    };
    exports._addName = function (node, name) {
        if (name) {
            if (!exports.names[name]) {
                exports.names[name] = [];
            }
            exports.names[name].push(node);
        }
    };
    exports._removeName = function (name, _id) {
        if (!name) {
            return;
        }
        var nodes = exports.names[name];
        if (!nodes) {
            return;
        }
        for (var n = 0; n < nodes.length; n++) {
            var no = nodes[n];
            if (no._id === _id) {
                nodes.splice(n, 1);
            }
        }
        if (nodes.length === 0) {
            delete exports.names[name];
        }
    };
    var ABSOLUTE_OPACITY = 'absoluteOpacity', ABSOLUTE_TRANSFORM = 'absoluteTransform', ABSOLUTE_SCALE = 'absoluteScale', CANVAS = 'canvas', CHANGE = 'Change', CHILDREN = 'children', KONVA = 'konva', LISTENING = 'listening', MOUSEENTER = 'mouseenter', MOUSELEAVE = 'mouseleave', NAME = 'name', SET = 'set', SHAPE = 'Shape', SPACE = ' ', STAGE = 'stage', TRANSFORM = 'transform', UPPER_STAGE = 'Stage', VISIBLE = 'visible', TRANSFORM_CHANGE_STR = [
        'xChange.konva',
        'yChange.konva',
        'scaleXChange.konva',
        'scaleYChange.konva',
        'skewXChange.konva',
        'skewYChange.konva',
        'rotationChange.konva',
        'offsetXChange.konva',
        'offsetYChange.konva',
        'transformsEnabledChange.konva',
    ].join(SPACE);
    var emptyChildren = new Util.Collection();
    var idCounter = 1;
    var Node = (function () {
        function Node(config) {
            this._id = idCounter++;
            this.eventListeners = {};
            this.attrs = {};
            this.index = 0;
            this._allEventListeners = null;
            this.parent = null;
            this._cache = new Map();
            this._attachedDepsListeners = new Map();
            this._lastPos = null;
            this._batchingTransformChange = false;
            this._needClearTransformCache = false;
            this._filterUpToDate = false;
            this._isUnderCache = false;
            this.children = emptyChildren;
            this._dragEventId = null;
            this._shouldFireChangeEvents = false;
            this.setAttrs(config);
            this._shouldFireChangeEvents = true;
        }
        Node.prototype.hasChildren = function () {
            return false;
        };
        Node.prototype.getChildren = function () {
            return emptyChildren;
        };
        Node.prototype._clearCache = function (attr) {
            if ((attr === TRANSFORM || attr === ABSOLUTE_TRANSFORM) &&
                this._cache.get(attr)) {
                this._cache.get(attr).dirty = true;
            }
            else if (attr) {
                this._cache.delete(attr);
            }
            else {
                this._cache.clear();
            }
        };
        Node.prototype._getCache = function (attr, privateGetter) {
            var cache = this._cache.get(attr);
            var isTransform = attr === TRANSFORM || attr === ABSOLUTE_TRANSFORM;
            var invalid = cache === undefined || (isTransform && cache.dirty === true);
            if (invalid) {
                cache = privateGetter.call(this);
                this._cache.set(attr, cache);
            }
            return cache;
        };
        Node.prototype._calculate = function (name, deps, getter) {
            var _this = this;
            if (!this._attachedDepsListeners.get(name)) {
                var depsString = deps.map(function (dep) { return dep + 'Change.konva'; }).join(SPACE);
                this.on(depsString, function () {
                    _this._clearCache(name);
                });
                this._attachedDepsListeners.set(name, true);
            }
            return this._getCache(name, getter);
        };
        Node.prototype._getCanvasCache = function () {
            return this._cache.get(CANVAS);
        };
        Node.prototype._clearSelfAndDescendantCache = function (attr, forceEvent) {
            this._clearCache(attr);
            if (forceEvent && attr === ABSOLUTE_TRANSFORM) {
                this.fire('_clearTransformCache');
            }
            if (this.isCached()) {
                return;
            }
            if (this.children) {
                this.children.each(function (node) {
                    node._clearSelfAndDescendantCache(attr, true);
                });
            }
        };
        Node.prototype.clearCache = function () {
            this._cache.delete(CANVAS);
            this._clearSelfAndDescendantCache();
            return this;
        };
        Node.prototype.cache = function (config) {
            var conf = config || {};
            var rect = {};
            if (conf.x === undefined ||
                conf.y === undefined ||
                conf.width === undefined ||
                conf.height === undefined) {
                rect = this.getClientRect({
                    skipTransform: true,
                    relativeTo: this.getParent(),
                });
            }
            var width = Math.ceil(conf.width || rect.width), height = Math.ceil(conf.height || rect.height), pixelRatio = conf.pixelRatio, x = conf.x === undefined ? rect.x : conf.x, y = conf.y === undefined ? rect.y : conf.y, offset = conf.offset || 0, drawBorder = conf.drawBorder || false;
            if (!width || !height) {
                Util.Util.error('Can not cache the node. Width or height of the node equals 0. Caching is skipped.');
                return;
            }
            width += offset * 2;
            height += offset * 2;
            x -= offset;
            y -= offset;
            var cachedSceneCanvas = new Canvas_1.SceneCanvas({
                pixelRatio: pixelRatio,
                width: width,
                height: height,
            }), cachedFilterCanvas = new Canvas_1.SceneCanvas({
                pixelRatio: pixelRatio,
                width: 0,
                height: 0,
            }), cachedHitCanvas = new Canvas_1.HitCanvas({
                pixelRatio: 1,
                width: width,
                height: height,
            }), sceneContext = cachedSceneCanvas.getContext(), hitContext = cachedHitCanvas.getContext();
            cachedHitCanvas.isCache = true;
            cachedSceneCanvas.isCache = true;
            this._cache.delete('canvas');
            this._filterUpToDate = false;
            if (conf.imageSmoothingEnabled === false) {
                cachedSceneCanvas.getContext()._context.imageSmoothingEnabled = false;
                cachedFilterCanvas.getContext()._context.imageSmoothingEnabled = false;
            }
            sceneContext.save();
            hitContext.save();
            sceneContext.translate(-x, -y);
            hitContext.translate(-x, -y);
            this._isUnderCache = true;
            this._clearSelfAndDescendantCache(ABSOLUTE_OPACITY);
            this._clearSelfAndDescendantCache(ABSOLUTE_SCALE);
            this.drawScene(cachedSceneCanvas, this);
            this.drawHit(cachedHitCanvas, this);
            this._isUnderCache = false;
            sceneContext.restore();
            hitContext.restore();
            if (drawBorder) {
                sceneContext.save();
                sceneContext.beginPath();
                sceneContext.rect(0, 0, width, height);
                sceneContext.closePath();
                sceneContext.setAttr('strokeStyle', 'red');
                sceneContext.setAttr('lineWidth', 5);
                sceneContext.stroke();
                sceneContext.restore();
            }
            this._cache.set(CANVAS, {
                scene: cachedSceneCanvas,
                filter: cachedFilterCanvas,
                hit: cachedHitCanvas,
                x: x,
                y: y,
            });
            return this;
        };
        Node.prototype.isCached = function () {
            return this._cache.has('canvas');
        };
        Node.prototype.getClientRect = function (config) {
            throw new Error('abstract "getClientRect" method call');
        };
        Node.prototype._transformedRect = function (rect, top) {
            var points = [
                { x: rect.x, y: rect.y },
                { x: rect.x + rect.width, y: rect.y },
                { x: rect.x + rect.width, y: rect.y + rect.height },
                { x: rect.x, y: rect.y + rect.height },
            ];
            var minX, minY, maxX, maxY;
            var trans = this.getAbsoluteTransform(top);
            points.forEach(function (point) {
                var transformed = trans.point(point);
                if (minX === undefined) {
                    minX = maxX = transformed.x;
                    minY = maxY = transformed.y;
                }
                minX = Math.min(minX, transformed.x);
                minY = Math.min(minY, transformed.y);
                maxX = Math.max(maxX, transformed.x);
                maxY = Math.max(maxY, transformed.y);
            });
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
            };
        };
        Node.prototype._drawCachedSceneCanvas = function (context) {
            context.save();
            context._applyOpacity(this);
            context._applyGlobalCompositeOperation(this);
            var canvasCache = this._getCanvasCache();
            context.translate(canvasCache.x, canvasCache.y);
            var cacheCanvas = this._getCachedSceneCanvas();
            var ratio = cacheCanvas.pixelRatio;
            context.drawImage(cacheCanvas._canvas, 0, 0, cacheCanvas.width / ratio, cacheCanvas.height / ratio);
            context.restore();
        };
        Node.prototype._drawCachedHitCanvas = function (context) {
            var canvasCache = this._getCanvasCache(), hitCanvas = canvasCache.hit;
            context.save();
            context.translate(canvasCache.x, canvasCache.y);
            context.drawImage(hitCanvas._canvas, 0, 0);
            context.restore();
        };
        Node.prototype._getCachedSceneCanvas = function () {
            var filters = this.filters(), cachedCanvas = this._getCanvasCache(), sceneCanvas = cachedCanvas.scene, filterCanvas = cachedCanvas.filter, filterContext = filterCanvas.getContext(), len, imageData, n, filter;
            if (filters) {
                if (!this._filterUpToDate) {
                    var ratio = sceneCanvas.pixelRatio;
                    filterCanvas.setSize(sceneCanvas.width / sceneCanvas.pixelRatio, sceneCanvas.height / sceneCanvas.pixelRatio);
                    try {
                        len = filters.length;
                        filterContext.clear();
                        filterContext.drawImage(sceneCanvas._canvas, 0, 0, sceneCanvas.getWidth() / ratio, sceneCanvas.getHeight() / ratio);
                        imageData = filterContext.getImageData(0, 0, filterCanvas.getWidth(), filterCanvas.getHeight());
                        for (n = 0; n < len; n++) {
                            filter = filters[n];
                            if (typeof filter !== 'function') {
                                Util.Util.error('Filter should be type of function, but got ' +
                                    typeof filter +
                                    ' instead. Please check correct filters');
                                continue;
                            }
                            filter.call(this, imageData);
                            filterContext.putImageData(imageData, 0, 0);
                        }
                    }
                    catch (e) {
                        Util.Util.error('Unable to apply filter. ' +
                            e.message +
                            ' This post my help you https://konvajs.org/docs/posts/Tainted_Canvas.html.');
                    }
                    this._filterUpToDate = true;
                }
                return filterCanvas;
            }
            return sceneCanvas;
        };
        Node.prototype.on = function (evtStr, handler) {
            if (arguments.length === 3) {
                return this._delegate.apply(this, arguments);
            }
            var events = evtStr.split(SPACE), len = events.length, n, event, parts, baseEvent, name;
            for (n = 0; n < len; n++) {
                event = events[n];
                parts = event.split('.');
                baseEvent = parts[0];
                name = parts[1] || '';
                if (!this.eventListeners[baseEvent]) {
                    this.eventListeners[baseEvent] = [];
                }
                this.eventListeners[baseEvent].push({
                    name: name,
                    handler: handler,
                });
            }
            return this;
        };
        Node.prototype.off = function (evtStr, callback) {
            var events = (evtStr || '').split(SPACE), len = events.length, n, t, event, parts, baseEvent, name;
            if (!evtStr) {
                for (t in this.eventListeners) {
                    this._off(t);
                }
            }
            for (n = 0; n < len; n++) {
                event = events[n];
                parts = event.split('.');
                baseEvent = parts[0];
                name = parts[1];
                if (baseEvent) {
                    if (this.eventListeners[baseEvent]) {
                        this._off(baseEvent, name, callback);
                    }
                }
                else {
                    for (t in this.eventListeners) {
                        this._off(t, name, callback);
                    }
                }
            }
            return this;
        };
        Node.prototype.dispatchEvent = function (evt) {
            var e = {
                target: this,
                type: evt.type,
                evt: evt,
            };
            this.fire(evt.type, e);
            return this;
        };
        Node.prototype.addEventListener = function (type, handler) {
            this.on(type, function (evt) {
                handler.call(this, evt.evt);
            });
            return this;
        };
        Node.prototype.removeEventListener = function (type) {
            this.off(type);
            return this;
        };
        Node.prototype._delegate = function (event, selector, handler) {
            var stopNode = this;
            this.on(event, function (evt) {
                var targets = evt.target.findAncestors(selector, true, stopNode);
                for (var i = 0; i < targets.length; i++) {
                    evt = Util.Util.cloneObject(evt);
                    evt.currentTarget = targets[i];
                    handler.call(targets[i], evt);
                }
            });
        };
        Node.prototype.remove = function () {
            if (this.isDragging()) {
                this.stopDrag();
            }
            DragAndDrop.DD._dragElements.delete(this._id);
            this._remove();
            return this;
        };
        Node.prototype._clearCaches = function () {
            this._clearSelfAndDescendantCache(ABSOLUTE_TRANSFORM);
            this._clearSelfAndDescendantCache(ABSOLUTE_OPACITY);
            this._clearSelfAndDescendantCache(ABSOLUTE_SCALE);
            this._clearSelfAndDescendantCache(STAGE);
            this._clearSelfAndDescendantCache(VISIBLE);
            this._clearSelfAndDescendantCache(LISTENING);
        };
        Node.prototype._remove = function () {
            this._clearCaches();
            var parent = this.getParent();
            if (parent && parent.children) {
                parent.children.splice(this.index, 1);
                parent._setChildrenIndices();
                this.parent = null;
            }
        };
        Node.prototype.destroy = function () {
            exports._removeId(this.id(), this);
            var names = (this.name() || '').split(/\s/g);
            for (var i = 0; i < names.length; i++) {
                var subname = names[i];
                exports._removeName(subname, this._id);
            }
            this.remove();
            return this;
        };
        Node.prototype.getAttr = function (attr) {
            var method = 'get' + Util.Util._capitalize(attr);
            if (Util.Util._isFunction(this[method])) {
                return this[method]();
            }
            return this.attrs[attr];
        };
        Node.prototype.getAncestors = function () {
            var parent = this.getParent(), ancestors = new Util.Collection();
            while (parent) {
                ancestors.push(parent);
                parent = parent.getParent();
            }
            return ancestors;
        };
        Node.prototype.getAttrs = function () {
            return this.attrs || {};
        };
        Node.prototype.setAttrs = function (config) {
            var _this = this;
            this._batchTransformChanges(function () {
                var key, method;
                if (!config) {
                    return _this;
                }
                for (key in config) {
                    if (key === CHILDREN) {
                        continue;
                    }
                    method = SET + Util.Util._capitalize(key);
                    if (Util.Util._isFunction(_this[method])) {
                        _this[method](config[key]);
                    }
                    else {
                        _this._setAttr(key, config[key]);
                    }
                }
            });
            return this;
        };
        Node.prototype.isListening = function () {
            return this._getCache(LISTENING, this._isListening);
        };
        Node.prototype._isListening = function (relativeTo) {
            var listening = this.listening();
            if (!listening) {
                return false;
            }
            var parent = this.getParent();
            if (parent && parent !== relativeTo && this !== relativeTo) {
                return parent._isListening(relativeTo);
            }
            else {
                return true;
            }
        };
        Node.prototype.isVisible = function () {
            return this._getCache(VISIBLE, this._isVisible);
        };
        Node.prototype._isVisible = function (relativeTo) {
            var visible = this.visible();
            if (!visible) {
                return false;
            }
            var parent = this.getParent();
            if (parent && parent !== relativeTo && this !== relativeTo) {
                return parent._isVisible(relativeTo);
            }
            else {
                return true;
            }
        };
        Node.prototype.shouldDrawHit = function (top) {
            if (top) {
                return this._isVisible(top) && this._isListening(top);
            }
            var layer = this.getLayer();
            var layerUnderDrag = false;
            DragAndDrop.DD._dragElements.forEach(function (elem) {
                if (elem.dragStatus !== 'dragging') {
                    return;
                }
                else if (elem.node.nodeType === 'Stage') {
                    layerUnderDrag = true;
                }
                else if (elem.node.getLayer() === layer) {
                    layerUnderDrag = true;
                }
            });
            var dragSkip = !Global.Konva.hitOnDragEnabled && layerUnderDrag;
            return this.isListening() && this.isVisible() && !dragSkip;
        };
        Node.prototype.show = function () {
            this.visible(true);
            return this;
        };
        Node.prototype.hide = function () {
            this.visible(false);
            return this;
        };
        Node.prototype.getZIndex = function () {
            return this.index || 0;
        };
        Node.prototype.getAbsoluteZIndex = function () {
            var depth = this.getDepth(), that = this, index = 0, nodes, len, n, child;
            function addChildren(children) {
                nodes = [];
                len = children.length;
                for (n = 0; n < len; n++) {
                    child = children[n];
                    index++;
                    if (child.nodeType !== SHAPE) {
                        nodes = nodes.concat(child.getChildren().toArray());
                    }
                    if (child._id === that._id) {
                        n = len;
                    }
                }
                if (nodes.length > 0 && nodes[0].getDepth() <= depth) {
                    addChildren(nodes);
                }
            }
            if (that.nodeType !== UPPER_STAGE) {
                addChildren(that.getStage().getChildren());
            }
            return index;
        };
        Node.prototype.getDepth = function () {
            var depth = 0, parent = this.parent;
            while (parent) {
                depth++;
                parent = parent.parent;
            }
            return depth;
        };
        Node.prototype._batchTransformChanges = function (func) {
            this._batchingTransformChange = true;
            func();
            this._batchingTransformChange = false;
            if (this._needClearTransformCache) {
                this._clearCache(TRANSFORM);
                this._clearSelfAndDescendantCache(ABSOLUTE_TRANSFORM, true);
            }
            this._needClearTransformCache = false;
        };
        Node.prototype.setPosition = function (pos) {
            var _this = this;
            this._batchTransformChanges(function () {
                _this.x(pos.x);
                _this.y(pos.y);
            });
            return this;
        };
        Node.prototype.getPosition = function () {
            return {
                x: this.x(),
                y: this.y(),
            };
        };
        Node.prototype.getAbsolutePosition = function (top) {
            var haveCachedParent = false;
            var parent = this.parent;
            while (parent) {
                if (parent.isCached()) {
                    haveCachedParent = true;
                    break;
                }
                parent = parent.parent;
            }
            if (haveCachedParent && !top) {
                top = true;
            }
            var absoluteMatrix = this.getAbsoluteTransform(top).getMatrix(), absoluteTransform = new Util.Transform(), offset = this.offset();
            absoluteTransform.m = absoluteMatrix.slice();
            absoluteTransform.translate(offset.x, offset.y);
            return absoluteTransform.getTranslation();
        };
        Node.prototype.setAbsolutePosition = function (pos) {
            var origTrans = this._clearTransform();
            this.attrs.x = origTrans.x;
            this.attrs.y = origTrans.y;
            delete origTrans.x;
            delete origTrans.y;
            this._clearCache(TRANSFORM);
            var it = this._getAbsoluteTransform().copy();
            it.invert();
            it.translate(pos.x, pos.y);
            pos = {
                x: this.attrs.x + it.getTranslation().x,
                y: this.attrs.y + it.getTranslation().y,
            };
            this._setTransform(origTrans);
            this.setPosition({ x: pos.x, y: pos.y });
            this._clearCache(TRANSFORM);
            this._clearSelfAndDescendantCache(ABSOLUTE_TRANSFORM);
            return this;
        };
        Node.prototype._setTransform = function (trans) {
            var key;
            for (key in trans) {
                this.attrs[key] = trans[key];
            }
        };
        Node.prototype._clearTransform = function () {
            var trans = {
                x: this.x(),
                y: this.y(),
                rotation: this.rotation(),
                scaleX: this.scaleX(),
                scaleY: this.scaleY(),
                offsetX: this.offsetX(),
                offsetY: this.offsetY(),
                skewX: this.skewX(),
                skewY: this.skewY(),
            };
            this.attrs.x = 0;
            this.attrs.y = 0;
            this.attrs.rotation = 0;
            this.attrs.scaleX = 1;
            this.attrs.scaleY = 1;
            this.attrs.offsetX = 0;
            this.attrs.offsetY = 0;
            this.attrs.skewX = 0;
            this.attrs.skewY = 0;
            return trans;
        };
        Node.prototype.move = function (change) {
            var changeX = change.x, changeY = change.y, x = this.x(), y = this.y();
            if (changeX !== undefined) {
                x += changeX;
            }
            if (changeY !== undefined) {
                y += changeY;
            }
            this.setPosition({ x: x, y: y });
            return this;
        };
        Node.prototype._eachAncestorReverse = function (func, top) {
            var family = [], parent = this.getParent(), len, n;
            if (top && top._id === this._id) {
                return;
            }
            family.unshift(this);
            while (parent && (!top || parent._id !== top._id)) {
                family.unshift(parent);
                parent = parent.parent;
            }
            len = family.length;
            for (n = 0; n < len; n++) {
                func(family[n]);
            }
        };
        Node.prototype.rotate = function (theta) {
            this.rotation(this.rotation() + theta);
            return this;
        };
        Node.prototype.moveToTop = function () {
            if (!this.parent) {
                Util.Util.warn('Node has no parent. moveToTop function is ignored.');
                return false;
            }
            var index = this.index;
            this.parent.children.splice(index, 1);
            this.parent.children.push(this);
            this.parent._setChildrenIndices();
            return true;
        };
        Node.prototype.moveUp = function () {
            if (!this.parent) {
                Util.Util.warn('Node has no parent. moveUp function is ignored.');
                return false;
            }
            var index = this.index, len = this.parent.getChildren().length;
            if (index < len - 1) {
                this.parent.children.splice(index, 1);
                this.parent.children.splice(index + 1, 0, this);
                this.parent._setChildrenIndices();
                return true;
            }
            return false;
        };
        Node.prototype.moveDown = function () {
            if (!this.parent) {
                Util.Util.warn('Node has no parent. moveDown function is ignored.');
                return false;
            }
            var index = this.index;
            if (index > 0) {
                this.parent.children.splice(index, 1);
                this.parent.children.splice(index - 1, 0, this);
                this.parent._setChildrenIndices();
                return true;
            }
            return false;
        };
        Node.prototype.moveToBottom = function () {
            if (!this.parent) {
                Util.Util.warn('Node has no parent. moveToBottom function is ignored.');
                return false;
            }
            var index = this.index;
            if (index > 0) {
                this.parent.children.splice(index, 1);
                this.parent.children.unshift(this);
                this.parent._setChildrenIndices();
                return true;
            }
            return false;
        };
        Node.prototype.setZIndex = function (zIndex) {
            if (!this.parent) {
                Util.Util.warn('Node has no parent. zIndex parameter is ignored.');
                return this;
            }
            if (zIndex < 0 || zIndex >= this.parent.children.length) {
                Util.Util.warn('Unexpected value ' +
                    zIndex +
                    ' for zIndex property. zIndex is just index of a node in children of its parent. Expected value is from 0 to ' +
                    (this.parent.children.length - 1) +
                    '.');
            }
            var index = this.index;
            this.parent.children.splice(index, 1);
            this.parent.children.splice(zIndex, 0, this);
            this.parent._setChildrenIndices();
            return this;
        };
        Node.prototype.getAbsoluteOpacity = function () {
            return this._getCache(ABSOLUTE_OPACITY, this._getAbsoluteOpacity);
        };
        Node.prototype._getAbsoluteOpacity = function () {
            var absOpacity = this.opacity();
            var parent = this.getParent();
            if (parent && !parent._isUnderCache) {
                absOpacity *= parent.getAbsoluteOpacity();
            }
            return absOpacity;
        };
        Node.prototype.moveTo = function (newContainer) {
            if (this.getParent() !== newContainer) {
                this._remove();
                newContainer.add(this);
            }
            return this;
        };
        Node.prototype.toObject = function () {
            var obj = {}, attrs = this.getAttrs(), key, val, getter, defaultValue, nonPlainObject;
            obj.attrs = {};
            for (key in attrs) {
                val = attrs[key];
                nonPlainObject =
                    Util.Util.isObject(val) && !Util.Util._isPlainObject(val) && !Util.Util._isArray(val);
                if (nonPlainObject) {
                    continue;
                }
                getter = typeof this[key] === 'function' && this[key];
                delete attrs[key];
                defaultValue = getter ? getter.call(this) : null;
                attrs[key] = val;
                if (defaultValue !== val) {
                    obj.attrs[key] = val;
                }
            }
            obj.className = this.getClassName();
            return Util.Util._prepareToStringify(obj);
        };
        Node.prototype.toJSON = function () {
            return JSON.stringify(this.toObject());
        };
        Node.prototype.getParent = function () {
            return this.parent;
        };
        Node.prototype.findAncestors = function (selector, includeSelf, stopNode) {
            var res = [];
            if (includeSelf && this._isMatch(selector)) {
                res.push(this);
            }
            var ancestor = this.parent;
            while (ancestor) {
                if (ancestor === stopNode) {
                    return res;
                }
                if (ancestor._isMatch(selector)) {
                    res.push(ancestor);
                }
                ancestor = ancestor.parent;
            }
            return res;
        };
        Node.prototype.isAncestorOf = function (node) {
            return false;
        };
        Node.prototype.findAncestor = function (selector, includeSelf, stopNode) {
            return this.findAncestors(selector, includeSelf, stopNode)[0];
        };
        Node.prototype._isMatch = function (selector) {
            if (!selector) {
                return false;
            }
            if (typeof selector === 'function') {
                return selector(this);
            }
            var selectorArr = selector.replace(/ /g, '').split(','), len = selectorArr.length, n, sel;
            for (n = 0; n < len; n++) {
                sel = selectorArr[n];
                if (!Util.Util.isValidSelector(sel)) {
                    Util.Util.warn('Selector "' +
                        sel +
                        '" is invalid. Allowed selectors examples are "#foo", ".bar" or "Group".');
                    Util.Util.warn('If you have a custom shape with such className, please change it to start with upper letter like "Triangle".');
                    Util.Util.warn('Konva is awesome, right?');
                }
                if (sel.charAt(0) === '#') {
                    if (this.id() === sel.slice(1)) {
                        return true;
                    }
                }
                else if (sel.charAt(0) === '.') {
                    if (this.hasName(sel.slice(1))) {
                        return true;
                    }
                }
                else if (this.className === sel || this.nodeType === sel) {
                    return true;
                }
            }
            return false;
        };
        Node.prototype.getLayer = function () {
            var parent = this.getParent();
            return parent ? parent.getLayer() : null;
        };
        Node.prototype.getStage = function () {
            return this._getCache(STAGE, this._getStage);
        };
        Node.prototype._getStage = function () {
            var parent = this.getParent();
            if (parent) {
                return parent.getStage();
            }
            else {
                return undefined;
            }
        };
        Node.prototype.fire = function (eventType, evt, bubble) {
            if (evt === void 0) { evt = {}; }
            evt.target = evt.target || this;
            if (bubble) {
                this._fireAndBubble(eventType, evt);
            }
            else {
                this._fire(eventType, evt);
            }
            return this;
        };
        Node.prototype.getAbsoluteTransform = function (top) {
            if (top) {
                return this._getAbsoluteTransform(top);
            }
            else {
                return this._getCache(ABSOLUTE_TRANSFORM, this._getAbsoluteTransform);
            }
        };
        Node.prototype._getAbsoluteTransform = function (top) {
            var at;
            if (top) {
                at = new Util.Transform();
                this._eachAncestorReverse(function (node) {
                    var transformsEnabled = node.transformsEnabled();
                    if (transformsEnabled === 'all') {
                        at.multiply(node.getTransform());
                    }
                    else if (transformsEnabled === 'position') {
                        at.translate(node.x() - node.offsetX(), node.y() - node.offsetY());
                    }
                }, top);
                return at;
            }
            else {
                at = this._cache.get(ABSOLUTE_TRANSFORM) || new Util.Transform();
                if (this.parent) {
                    this.parent.getAbsoluteTransform().copyInto(at);
                }
                else {
                    at.reset();
                }
                var transformsEnabled = this.transformsEnabled();
                if (transformsEnabled === 'all') {
                    at.multiply(this.getTransform());
                }
                else if (transformsEnabled === 'position') {
                    var x = this.attrs.x || 0;
                    var y = this.attrs.y || 0;
                    var offsetX = this.attrs.offsetX || 0;
                    var offsetY = this.attrs.offsetY || 0;
                    at.translate(x - offsetX, y - offsetY);
                }
                at.dirty = false;
                return at;
            }
        };
        Node.prototype.getAbsoluteScale = function (top) {
            var parent = this;
            while (parent) {
                if (parent._isUnderCache) {
                    top = parent;
                }
                parent = parent.getParent();
            }
            var transform = this.getAbsoluteTransform(top);
            var attrs = transform.decompose();
            return {
                x: attrs.scaleX,
                y: attrs.scaleY,
            };
        };
        Node.prototype.getAbsoluteRotation = function () {
            return this.getAbsoluteTransform().decompose().rotation;
        };
        Node.prototype.getTransform = function () {
            return this._getCache(TRANSFORM, this._getTransform);
        };
        Node.prototype._getTransform = function () {
            var _a, _b;
            var m = this._cache.get(TRANSFORM) || new Util.Transform();
            m.reset();
            var x = this.x(), y = this.y(), rotation = Global.Konva.getAngle(this.rotation()), scaleX = (_a = this.attrs.scaleX) !== null && _a !== void 0 ? _a : 1, scaleY = (_b = this.attrs.scaleY) !== null && _b !== void 0 ? _b : 1, skewX = this.attrs.skewX || 0, skewY = this.attrs.skewY || 0, offsetX = this.attrs.offsetX || 0, offsetY = this.attrs.offsetY || 0;
            if (x !== 0 || y !== 0) {
                m.translate(x, y);
            }
            if (rotation !== 0) {
                m.rotate(rotation);
            }
            if (skewX !== 0 || skewY !== 0) {
                m.skew(skewX, skewY);
            }
            if (scaleX !== 1 || scaleY !== 1) {
                m.scale(scaleX, scaleY);
            }
            if (offsetX !== 0 || offsetY !== 0) {
                m.translate(-1 * offsetX, -1 * offsetY);
            }
            m.dirty = false;
            return m;
        };
        Node.prototype.clone = function (obj) {
            var attrs = Util.Util.cloneObject(this.attrs), key, allListeners, len, n, listener;
            for (key in obj) {
                attrs[key] = obj[key];
            }
            var node = new this.constructor(attrs);
            for (key in this.eventListeners) {
                allListeners = this.eventListeners[key];
                len = allListeners.length;
                for (n = 0; n < len; n++) {
                    listener = allListeners[n];
                    if (listener.name.indexOf(KONVA) < 0) {
                        if (!node.eventListeners[key]) {
                            node.eventListeners[key] = [];
                        }
                        node.eventListeners[key].push(listener);
                    }
                }
            }
            return node;
        };
        Node.prototype._toKonvaCanvas = function (config) {
            config = config || {};
            var box = this.getClientRect();
            var stage = this.getStage(), x = config.x !== undefined ? config.x : box.x, y = config.y !== undefined ? config.y : box.y, pixelRatio = config.pixelRatio || 1, canvas = new Canvas_1.SceneCanvas({
                width: config.width || box.width || (stage ? stage.width() : 0),
                height: config.height || box.height || (stage ? stage.height() : 0),
                pixelRatio: pixelRatio,
            }), context = canvas.getContext();
            context.save();
            if (x || y) {
                context.translate(-1 * x, -1 * y);
            }
            this.drawScene(canvas);
            context.restore();
            return canvas;
        };
        Node.prototype.toCanvas = function (config) {
            return this._toKonvaCanvas(config)._canvas;
        };
        Node.prototype.toDataURL = function (config) {
            config = config || {};
            var mimeType = config.mimeType || null, quality = config.quality || null;
            var url = this._toKonvaCanvas(config).toDataURL(mimeType, quality);
            if (config.callback) {
                config.callback(url);
            }
            return url;
        };
        Node.prototype.toImage = function (config) {
            if (!config || !config.callback) {
                throw 'callback required for toImage method config argument';
            }
            var callback = config.callback;
            delete config.callback;
            Util.Util._urlToImage(this.toDataURL(config), function (img) {
                callback(img);
            });
        };
        Node.prototype.setSize = function (size) {
            this.width(size.width);
            this.height(size.height);
            return this;
        };
        Node.prototype.getSize = function () {
            return {
                width: this.width(),
                height: this.height(),
            };
        };
        Node.prototype.getClassName = function () {
            return this.className || this.nodeType;
        };
        Node.prototype.getType = function () {
            return this.nodeType;
        };
        Node.prototype.getDragDistance = function () {
            if (this.attrs.dragDistance !== undefined) {
                return this.attrs.dragDistance;
            }
            else if (this.parent) {
                return this.parent.getDragDistance();
            }
            else {
                return Global.Konva.dragDistance;
            }
        };
        Node.prototype._off = function (type, name, callback) {
            var evtListeners = this.eventListeners[type], i, evtName, handler;
            for (i = 0; i < evtListeners.length; i++) {
                evtName = evtListeners[i].name;
                handler = evtListeners[i].handler;
                if ((evtName !== 'konva' || name === 'konva') &&
                    (!name || evtName === name) &&
                    (!callback || callback === handler)) {
                    evtListeners.splice(i, 1);
                    if (evtListeners.length === 0) {
                        delete this.eventListeners[type];
                        break;
                    }
                    i--;
                }
            }
        };
        Node.prototype._fireChangeEvent = function (attr, oldVal, newVal) {
            this._fire(attr + CHANGE, {
                oldVal: oldVal,
                newVal: newVal,
            });
        };
        Node.prototype.setId = function (id) {
            var oldId = this.id();
            exports._removeId(oldId, this);
            _addId(this, id);
            this._setAttr('id', id);
            return this;
        };
        Node.prototype.setName = function (name) {
            var oldNames = (this.name() || '').split(/\s/g);
            var newNames = (name || '').split(/\s/g);
            var subname, i;
            for (i = 0; i < oldNames.length; i++) {
                subname = oldNames[i];
                if (newNames.indexOf(subname) === -1 && subname) {
                    exports._removeName(subname, this._id);
                }
            }
            for (i = 0; i < newNames.length; i++) {
                subname = newNames[i];
                if (oldNames.indexOf(subname) === -1 && subname) {
                    exports._addName(this, subname);
                }
            }
            this._setAttr(NAME, name);
            return this;
        };
        Node.prototype.addName = function (name) {
            if (!this.hasName(name)) {
                var oldName = this.name();
                var newName = oldName ? oldName + ' ' + name : name;
                this.setName(newName);
            }
            return this;
        };
        Node.prototype.hasName = function (name) {
            if (!name) {
                return false;
            }
            var fullName = this.name();
            if (!fullName) {
                return false;
            }
            var names = (fullName || '').split(/\s/g);
            return names.indexOf(name) !== -1;
        };
        Node.prototype.removeName = function (name) {
            var names = (this.name() || '').split(/\s/g);
            var index = names.indexOf(name);
            if (index !== -1) {
                names.splice(index, 1);
                this.setName(names.join(' '));
            }
            return this;
        };
        Node.prototype.setAttr = function (attr, val) {
            var func = this[SET + Util.Util._capitalize(attr)];
            if (Util.Util._isFunction(func)) {
                func.call(this, val);
            }
            else {
                this._setAttr(attr, val);
            }
            return this;
        };
        Node.prototype._setAttr = function (key, val, skipFire) {
            var oldVal = this.attrs[key];
            if (oldVal === val && !Util.Util.isObject(val)) {
                return;
            }
            if (val === undefined || val === null) {
                delete this.attrs[key];
            }
            else {
                this.attrs[key] = val;
            }
            if (this._shouldFireChangeEvents) {
                this._fireChangeEvent(key, oldVal, val);
            }
        };
        Node.prototype._setComponentAttr = function (key, component, val) {
            var oldVal;
            if (val !== undefined) {
                oldVal = this.attrs[key];
                if (!oldVal) {
                    this.attrs[key] = this.getAttr(key);
                }
                this.attrs[key][component] = val;
                this._fireChangeEvent(key, oldVal, val);
            }
        };
        Node.prototype._fireAndBubble = function (eventType, evt, compareShape) {
            if (evt && this.nodeType === SHAPE) {
                evt.target = this;
            }
            var shouldStop = (eventType === MOUSEENTER || eventType === MOUSELEAVE) &&
                ((compareShape &&
                    (this === compareShape ||
                        (this.isAncestorOf && this.isAncestorOf(compareShape)))) ||
                    (this.nodeType === 'Stage' && !compareShape));
            if (!shouldStop) {
                this._fire(eventType, evt);
                var stopBubble = (eventType === MOUSEENTER || eventType === MOUSELEAVE) &&
                    compareShape &&
                    compareShape.isAncestorOf &&
                    compareShape.isAncestorOf(this) &&
                    !compareShape.isAncestorOf(this.parent);
                if (((evt && !evt.cancelBubble) || !evt) &&
                    this.parent &&
                    this.parent.isListening() &&
                    !stopBubble) {
                    if (compareShape && compareShape.parent) {
                        this._fireAndBubble.call(this.parent, eventType, evt, compareShape);
                    }
                    else {
                        this._fireAndBubble.call(this.parent, eventType, evt);
                    }
                }
            }
        };
        Node.prototype._getListeners = function (eventType) {
            var totalEvents = [];
            var obj;
            while (true) {
                obj = obj ? Object.getPrototypeOf(obj) : this;
                if (!obj) {
                    break;
                }
                if (!obj.eventListeners) {
                    continue;
                }
                var events = obj.eventListeners[eventType];
                if (!events) {
                    continue;
                }
                totalEvents = events.concat(totalEvents);
                obj = Object.getPrototypeOf(obj);
            }
            return totalEvents;
        };
        Node.prototype._fire = function (eventType, evt) {
            var events = this._getListeners(eventType), i;
            if (events.length) {
                evt = evt || {};
                evt.currentTarget = this;
                evt.type = eventType;
                for (i = 0; i < events.length; i++) {
                    events[i].handler.call(this, evt);
                }
            }
        };
        Node.prototype.draw = function () {
            this.drawScene();
            this.drawHit();
            return this;
        };
        Node.prototype._createDragElement = function (evt) {
            var pointerId = evt ? evt.pointerId : undefined;
            var stage = this.getStage();
            var ap = this.getAbsolutePosition();
            var pos = stage._getPointerById(pointerId) ||
                stage._changedPointerPositions[0] ||
                ap;
            DragAndDrop.DD._dragElements.set(this._id, {
                node: this,
                startPointerPos: pos,
                offset: {
                    x: pos.x - ap.x,
                    y: pos.y - ap.y,
                },
                dragStatus: 'ready',
                pointerId: pointerId,
            });
        };
        Node.prototype.startDrag = function (evt, bubbleEvent) {
            if (bubbleEvent === void 0) { bubbleEvent = true; }
            if (!DragAndDrop.DD._dragElements.has(this._id)) {
                this._createDragElement(evt);
            }
            var elem = DragAndDrop.DD._dragElements.get(this._id);
            elem.dragStatus = 'dragging';
            this.fire('dragstart', {
                type: 'dragstart',
                target: this,
                evt: evt && evt.evt,
            }, bubbleEvent);
        };
        Node.prototype._setDragPosition = function (evt, elem) {
            var pos = this.getStage()._getPointerById(elem.pointerId);
            if (!pos) {
                return;
            }
            var newNodePos = {
                x: pos.x - elem.offset.x,
                y: pos.y - elem.offset.y,
            };
            var dbf = this.dragBoundFunc();
            if (dbf !== undefined) {
                var bounded = dbf.call(this, newNodePos, evt);
                if (!bounded) {
                    Util.Util.warn('dragBoundFunc did not return any value. That is unexpected behavior. You must return new absolute position from dragBoundFunc.');
                }
                else {
                    newNodePos = bounded;
                }
            }
            if (!this._lastPos ||
                this._lastPos.x !== newNodePos.x ||
                this._lastPos.y !== newNodePos.y) {
                this.setAbsolutePosition(newNodePos);
                if (this.getLayer()) {
                    this.getLayer().batchDraw();
                }
                else if (this.getStage()) {
                    this.getStage().batchDraw();
                }
            }
            this._lastPos = newNodePos;
        };
        Node.prototype.stopDrag = function (evt) {
            var elem = DragAndDrop.DD._dragElements.get(this._id);
            if (elem) {
                elem.dragStatus = 'stopped';
            }
            DragAndDrop.DD._endDragBefore(evt);
            DragAndDrop.DD._endDragAfter(evt);
        };
        Node.prototype.setDraggable = function (draggable) {
            this._setAttr('draggable', draggable);
            this._dragChange();
        };
        Node.prototype.isDragging = function () {
            var elem = DragAndDrop.DD._dragElements.get(this._id);
            return elem ? elem.dragStatus === 'dragging' : false;
        };
        Node.prototype._listenDrag = function () {
            this._dragCleanup();
            this.on('mousedown.konva touchstart.konva', function (evt) {
                var _this = this;
                var shouldCheckButton = evt.evt['button'] !== undefined;
                var canDrag = !shouldCheckButton || Global.Konva.dragButtons.indexOf(evt.evt['button']) >= 0;
                if (!canDrag) {
                    return;
                }
                if (this.isDragging()) {
                    return;
                }
                var hasDraggingChild = false;
                DragAndDrop.DD._dragElements.forEach(function (elem) {
                    if (_this.isAncestorOf(elem.node)) {
                        hasDraggingChild = true;
                    }
                });
                if (!hasDraggingChild) {
                    this._createDragElement(evt);
                }
            });
        };
        Node.prototype._dragChange = function () {
            if (this.attrs.draggable) {
                this._listenDrag();
            }
            else {
                this._dragCleanup();
                var stage = this.getStage();
                if (!stage) {
                    return;
                }
                var dragElement = DragAndDrop.DD._dragElements.get(this._id);
                var isDragging = dragElement && dragElement.dragStatus === 'dragging';
                var isReady = dragElement && dragElement.dragStatus === 'ready';
                if (isDragging) {
                    this.stopDrag();
                }
                else if (isReady) {
                    DragAndDrop.DD._dragElements.delete(this._id);
                }
            }
        };
        Node.prototype._dragCleanup = function () {
            this.off('mousedown.konva');
            this.off('touchstart.konva');
        };
        Node.create = function (data, container) {
            if (Util.Util._isString(data)) {
                data = JSON.parse(data);
            }
            return this._createNode(data, container);
        };
        Node._createNode = function (obj, container) {
            var className = Node.prototype.getClassName.call(obj), children = obj.children, no, len, n;
            if (container) {
                obj.attrs.container = container;
            }
            if (!Global._NODES_REGISTRY[className]) {
                Util.Util.warn('Can not find a node with class name "' +
                    className +
                    '". Fallback to "Shape".');
                className = 'Shape';
            }
            var Class = Global._NODES_REGISTRY[className];
            no = new Class(obj.attrs);
            if (children) {
                len = children.length;
                for (n = 0; n < len; n++) {
                    no.add(Node._createNode(children[n]));
                }
            }
            return no;
        };
        return Node;
    }());
    exports.Node = Node;
    Node.prototype.nodeType = 'Node';
    Node.prototype._attrsAffectingSize = [];
    Node.prototype.eventListeners = {};
    Node.prototype.on.call(Node.prototype, TRANSFORM_CHANGE_STR, function () {
        if (this._batchingTransformChange) {
            this._needClearTransformCache = true;
            return;
        }
        this._clearCache(TRANSFORM);
        this._clearSelfAndDescendantCache(ABSOLUTE_TRANSFORM);
    });
    Node.prototype.on.call(Node.prototype, 'visibleChange.konva', function () {
        this._clearSelfAndDescendantCache(VISIBLE);
    });
    Node.prototype.on.call(Node.prototype, 'listeningChange.konva', function () {
        this._clearSelfAndDescendantCache(LISTENING);
    });
    Node.prototype.on.call(Node.prototype, 'opacityChange.konva', function () {
        this._clearSelfAndDescendantCache(ABSOLUTE_OPACITY);
    });
    var addGetterSetter = Factory.Factory.addGetterSetter;
    addGetterSetter(Node, 'zIndex');
    addGetterSetter(Node, 'absolutePosition');
    addGetterSetter(Node, 'position');
    addGetterSetter(Node, 'x', 0, Validators.getNumberValidator());
    addGetterSetter(Node, 'y', 0, Validators.getNumberValidator());
    addGetterSetter(Node, 'globalCompositeOperation', 'source-over', Validators.getStringValidator());
    addGetterSetter(Node, 'opacity', 1, Validators.getNumberValidator());
    addGetterSetter(Node, 'name', '', Validators.getStringValidator());
    addGetterSetter(Node, 'id', '', Validators.getStringValidator());
    addGetterSetter(Node, 'rotation', 0, Validators.getNumberValidator());
    Factory.Factory.addComponentsGetterSetter(Node, 'scale', ['x', 'y']);
    addGetterSetter(Node, 'scaleX', 1, Validators.getNumberValidator());
    addGetterSetter(Node, 'scaleY', 1, Validators.getNumberValidator());
    Factory.Factory.addComponentsGetterSetter(Node, 'skew', ['x', 'y']);
    addGetterSetter(Node, 'skewX', 0, Validators.getNumberValidator());
    addGetterSetter(Node, 'skewY', 0, Validators.getNumberValidator());
    Factory.Factory.addComponentsGetterSetter(Node, 'offset', ['x', 'y']);
    addGetterSetter(Node, 'offsetX', 0, Validators.getNumberValidator());
    addGetterSetter(Node, 'offsetY', 0, Validators.getNumberValidator());
    addGetterSetter(Node, 'dragDistance', null, Validators.getNumberValidator());
    addGetterSetter(Node, 'width', 0, Validators.getNumberValidator());
    addGetterSetter(Node, 'height', 0, Validators.getNumberValidator());
    addGetterSetter(Node, 'listening', true, Validators.getBooleanValidator());
    addGetterSetter(Node, 'preventDefault', true, Validators.getBooleanValidator());
    addGetterSetter(Node, 'filters', null, function (val) {
        this._filterUpToDate = false;
        return val;
    });
    addGetterSetter(Node, 'visible', true, Validators.getBooleanValidator());
    addGetterSetter(Node, 'transformsEnabled', 'all', Validators.getStringValidator());
    addGetterSetter(Node, 'size');
    addGetterSetter(Node, 'dragBoundFunc');
    addGetterSetter(Node, 'draggable', false, Validators.getBooleanValidator());
    Factory.Factory.backCompat(Node, {
        rotateDeg: 'rotate',
        setRotationDeg: 'setRotation',
        getRotationDeg: 'getRotation',
    });
    Util.Collection.mapMethods(Node);
    });

    var Container_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });




    var Container = (function (_super) {
        __extends(Container, _super);
        function Container() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.children = new Util.Collection();
            return _this;
        }
        Container.prototype.getChildren = function (filterFunc) {
            if (!filterFunc) {
                return this.children;
            }
            var results = new Util.Collection();
            this.children.each(function (child) {
                if (filterFunc(child)) {
                    results.push(child);
                }
            });
            return results;
        };
        Container.prototype.hasChildren = function () {
            return this.getChildren().length > 0;
        };
        Container.prototype.removeChildren = function () {
            var child;
            for (var i = 0; i < this.children.length; i++) {
                child = this.children[i];
                child.parent = null;
                child.index = 0;
                child.remove();
            }
            this.children = new Util.Collection();
            return this;
        };
        Container.prototype.destroyChildren = function () {
            var child;
            for (var i = 0; i < this.children.length; i++) {
                child = this.children[i];
                child.parent = null;
                child.index = 0;
                child.destroy();
            }
            this.children = new Util.Collection();
            return this;
        };
        Container.prototype.add = function () {
            var children = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                children[_i] = arguments[_i];
            }
            if (arguments.length > 1) {
                for (var i = 0; i < arguments.length; i++) {
                    this.add(arguments[i]);
                }
                return this;
            }
            var child = children[0];
            if (child.getParent()) {
                child.moveTo(this);
                return this;
            }
            var _children = this.children;
            this._validateAdd(child);
            child._clearCaches();
            child.index = _children.length;
            child.parent = this;
            _children.push(child);
            this._fire('add', {
                child: child,
            });
            return this;
        };
        Container.prototype.destroy = function () {
            if (this.hasChildren()) {
                this.destroyChildren();
            }
            _super.prototype.destroy.call(this);
            return this;
        };
        Container.prototype.find = function (selector) {
            return this._generalFind(selector, false);
        };
        Container.prototype.get = function (selector) {
            Util.Util.warn('collection.get() method is deprecated. Please use collection.find() instead.');
            return this.find(selector);
        };
        Container.prototype.findOne = function (selector) {
            var result = this._generalFind(selector, true);
            return result.length > 0 ? result[0] : undefined;
        };
        Container.prototype._generalFind = function (selector, findOne) {
            var retArr = [];
            this._descendants(function (node) {
                var valid = node._isMatch(selector);
                if (valid) {
                    retArr.push(node);
                }
                if (valid && findOne) {
                    return true;
                }
                return false;
            });
            return Util.Collection.toCollection(retArr);
        };
        Container.prototype._descendants = function (fn) {
            var shouldStop = false;
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                shouldStop = fn(child);
                if (shouldStop) {
                    return true;
                }
                if (!child.hasChildren()) {
                    continue;
                }
                shouldStop = child._descendants(fn);
                if (shouldStop) {
                    return true;
                }
            }
            return false;
        };
        Container.prototype.toObject = function () {
            var obj = Node_1.Node.prototype.toObject.call(this);
            obj.children = [];
            var children = this.getChildren();
            var len = children.length;
            for (var n = 0; n < len; n++) {
                var child = children[n];
                obj.children.push(child.toObject());
            }
            return obj;
        };
        Container.prototype.isAncestorOf = function (node) {
            var parent = node.getParent();
            while (parent) {
                if (parent._id === this._id) {
                    return true;
                }
                parent = parent.getParent();
            }
            return false;
        };
        Container.prototype.clone = function (obj) {
            var node = Node_1.Node.prototype.clone.call(this, obj);
            this.getChildren().each(function (no) {
                node.add(no.clone());
            });
            return node;
        };
        Container.prototype.getAllIntersections = function (pos) {
            var arr = [];
            this.find('Shape').each(function (shape) {
                if (shape.isVisible() && shape.intersects(pos)) {
                    arr.push(shape);
                }
            });
            return arr;
        };
        Container.prototype._setChildrenIndices = function () {
            this.children.each(function (child, n) {
                child.index = n;
            });
        };
        Container.prototype.drawScene = function (can, top) {
            var layer = this.getLayer(), canvas = can || (layer && layer.getCanvas()), context = canvas && canvas.getContext(), cachedCanvas = this._getCanvasCache(), cachedSceneCanvas = cachedCanvas && cachedCanvas.scene;
            var caching = canvas && canvas.isCache;
            if (!this.isVisible() && !caching) {
                return this;
            }
            if (cachedSceneCanvas) {
                context.save();
                var m = this.getAbsoluteTransform(top).getMatrix();
                context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                this._drawCachedSceneCanvas(context);
                context.restore();
            }
            else {
                this._drawChildren('drawScene', canvas, top);
            }
            return this;
        };
        Container.prototype.drawHit = function (can, top) {
            if (!this.shouldDrawHit(top)) {
                return this;
            }
            var layer = this.getLayer(), canvas = can || (layer && layer.hitCanvas), context = canvas && canvas.getContext(), cachedCanvas = this._getCanvasCache(), cachedHitCanvas = cachedCanvas && cachedCanvas.hit;
            if (cachedHitCanvas) {
                context.save();
                var m = this.getAbsoluteTransform(top).getMatrix();
                context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                this._drawCachedHitCanvas(context);
                context.restore();
            }
            else {
                this._drawChildren('drawHit', canvas, top);
            }
            return this;
        };
        Container.prototype._drawChildren = function (drawMethod, canvas, top) {
            var context = canvas && canvas.getContext(), clipWidth = this.clipWidth(), clipHeight = this.clipHeight(), clipFunc = this.clipFunc(), hasClip = (clipWidth && clipHeight) || clipFunc;
            var selfCache = top === this;
            if (hasClip) {
                context.save();
                var transform = this.getAbsoluteTransform(top);
                var m = transform.getMatrix();
                context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                context.beginPath();
                if (clipFunc) {
                    clipFunc.call(this, context, this);
                }
                else {
                    var clipX = this.clipX();
                    var clipY = this.clipY();
                    context.rect(clipX, clipY, clipWidth, clipHeight);
                }
                context.clip();
                m = transform.copy().invert().getMatrix();
                context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
            }
            var hasComposition = !selfCache &&
                this.globalCompositeOperation() !== 'source-over' &&
                drawMethod === 'drawScene';
            if (hasComposition) {
                context.save();
                context._applyGlobalCompositeOperation(this);
            }
            this.children.each(function (child) {
                child[drawMethod](canvas, top);
            });
            if (hasComposition) {
                context.restore();
            }
            if (hasClip) {
                context.restore();
            }
        };
        Container.prototype.getClientRect = function (config) {
            config = config || {};
            var skipTransform = config.skipTransform;
            var relativeTo = config.relativeTo;
            var minX, minY, maxX, maxY;
            var selfRect = {
                x: Infinity,
                y: Infinity,
                width: 0,
                height: 0,
            };
            var that = this;
            this.children.each(function (child) {
                if (!child.visible()) {
                    return;
                }
                var rect = child.getClientRect({
                    relativeTo: that,
                    skipShadow: config.skipShadow,
                    skipStroke: config.skipStroke,
                });
                if (rect.width === 0 && rect.height === 0) {
                    return;
                }
                if (minX === undefined) {
                    minX = rect.x;
                    minY = rect.y;
                    maxX = rect.x + rect.width;
                    maxY = rect.y + rect.height;
                }
                else {
                    minX = Math.min(minX, rect.x);
                    minY = Math.min(minY, rect.y);
                    maxX = Math.max(maxX, rect.x + rect.width);
                    maxY = Math.max(maxY, rect.y + rect.height);
                }
            });
            var shapes = this.find('Shape');
            var hasVisible = false;
            for (var i = 0; i < shapes.length; i++) {
                var shape = shapes[i];
                if (shape._isVisible(this)) {
                    hasVisible = true;
                    break;
                }
            }
            if (hasVisible && minX !== undefined) {
                selfRect = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                };
            }
            else {
                selfRect = {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                };
            }
            if (!skipTransform) {
                return this._transformedRect(selfRect, relativeTo);
            }
            return selfRect;
        };
        return Container;
    }(Node_1.Node));
    exports.Container = Container;
    Factory.Factory.addComponentsGetterSetter(Container, 'clip', [
        'x',
        'y',
        'width',
        'height',
    ]);
    Factory.Factory.addGetterSetter(Container, 'clipX', undefined, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Container, 'clipY', undefined, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Container, 'clipWidth', undefined, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Container, 'clipHeight', undefined, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Container, 'clipFunc');
    Util.Collection.mapMethods(Container);
    });

    var PointerEvents = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    var Captures = new Map();
    var SUPPORT_POINTER_EVENTS = Global.Konva._global['PointerEvent'] !== undefined;
    function getCapturedShape(pointerId) {
        return Captures.get(pointerId);
    }
    exports.getCapturedShape = getCapturedShape;
    function createEvent(evt) {
        return {
            evt: evt,
            pointerId: evt.pointerId
        };
    }
    exports.createEvent = createEvent;
    function hasPointerCapture(pointerId, shape) {
        return Captures.get(pointerId) === shape;
    }
    exports.hasPointerCapture = hasPointerCapture;
    function setPointerCapture(pointerId, shape) {
        releaseCapture(pointerId);
        var stage = shape.getStage();
        if (!stage)
            return;
        Captures.set(pointerId, shape);
        if (SUPPORT_POINTER_EVENTS) {
            shape._fire('gotpointercapture', createEvent(new PointerEvent('gotpointercapture')));
        }
    }
    exports.setPointerCapture = setPointerCapture;
    function releaseCapture(pointerId, target) {
        var shape = Captures.get(pointerId);
        if (!shape)
            return;
        var stage = shape.getStage();
        if (stage && stage.content) ;
        Captures.delete(pointerId);
        if (SUPPORT_POINTER_EVENTS) {
            shape._fire('lostpointercapture', createEvent(new PointerEvent('lostpointercapture')));
        }
    }
    exports.releaseCapture = releaseCapture;
    });

    var Stage_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });






    var Global_2 = Global;

    var STAGE = 'Stage', STRING = 'string', PX = 'px', MOUSEOUT = 'mouseout', MOUSELEAVE = 'mouseleave', MOUSEOVER = 'mouseover', MOUSEENTER = 'mouseenter', MOUSEMOVE = 'mousemove', MOUSEDOWN = 'mousedown', MOUSEUP = 'mouseup', POINTERMOVE = 'pointermove', POINTERDOWN = 'pointerdown', POINTERUP = 'pointerup', POINTERCANCEL = 'pointercancel', LOSTPOINTERCAPTURE = 'lostpointercapture', CONTEXTMENU = 'contextmenu', CLICK = 'click', DBL_CLICK = 'dblclick', TOUCHSTART = 'touchstart', TOUCHEND = 'touchend', TAP = 'tap', DBL_TAP = 'dbltap', TOUCHMOVE = 'touchmove', WHEEL = 'wheel', CONTENT_MOUSEOUT = 'contentMouseout', CONTENT_MOUSEOVER = 'contentMouseover', CONTENT_MOUSEMOVE = 'contentMousemove', CONTENT_MOUSEDOWN = 'contentMousedown', CONTENT_MOUSEUP = 'contentMouseup', CONTENT_CONTEXTMENU = 'contentContextmenu', CONTENT_CLICK = 'contentClick', CONTENT_DBL_CLICK = 'contentDblclick', CONTENT_TOUCHSTART = 'contentTouchstart', CONTENT_TOUCHEND = 'contentTouchend', CONTENT_DBL_TAP = 'contentDbltap', CONTENT_TAP = 'contentTap', CONTENT_TOUCHMOVE = 'contentTouchmove', CONTENT_WHEEL = 'contentWheel', RELATIVE = 'relative', KONVA_CONTENT = 'konvajs-content', UNDERSCORE = '_', CONTAINER = 'container', MAX_LAYERS_NUMBER = 5, EMPTY_STRING = '', EVENTS = [
        MOUSEENTER,
        MOUSEDOWN,
        MOUSEMOVE,
        MOUSEUP,
        MOUSEOUT,
        TOUCHSTART,
        TOUCHMOVE,
        TOUCHEND,
        MOUSEOVER,
        WHEEL,
        CONTEXTMENU,
        POINTERDOWN,
        POINTERMOVE,
        POINTERUP,
        POINTERCANCEL,
        LOSTPOINTERCAPTURE,
    ], eventsLength = EVENTS.length;
    function addEvent(ctx, eventName) {
        ctx.content.addEventListener(eventName, function (evt) {
            ctx[UNDERSCORE + eventName](evt);
        }, false);
    }
    var NO_POINTERS_MESSAGE = "Pointer position is missing and not registered by the stage. Looks like it is outside of the stage container. You can set it manually from event: stage.setPointersPositions(event);";
    exports.stages = [];
    function checkNoClip(attrs) {
        if (attrs === void 0) { attrs = {}; }
        if (attrs.clipFunc || attrs.clipWidth || attrs.clipHeight) {
            Util.Util.warn('Stage does not support clipping. Please use clip for Layers or Groups.');
        }
        return attrs;
    }
    var Stage = (function (_super) {
        __extends(Stage, _super);
        function Stage(config) {
            var _this = _super.call(this, checkNoClip(config)) || this;
            _this._pointerPositions = [];
            _this._changedPointerPositions = [];
            _this._buildDOM();
            _this._bindContentEvents();
            exports.stages.push(_this);
            _this.on('widthChange.konva heightChange.konva', _this._resizeDOM);
            _this.on('visibleChange.konva', _this._checkVisibility);
            _this.on('clipWidthChange.konva clipHeightChange.konva clipFuncChange.konva', function () {
                checkNoClip(_this.attrs);
            });
            _this._checkVisibility();
            return _this;
        }
        Stage.prototype._validateAdd = function (child) {
            var isLayer = child.getType() === 'Layer';
            var isFastLayer = child.getType() === 'FastLayer';
            var valid = isLayer || isFastLayer;
            if (!valid) {
                Util.Util.throw('You may only add layers to the stage.');
            }
        };
        Stage.prototype._checkVisibility = function () {
            if (!this.content) {
                return;
            }
            var style = this.visible() ? '' : 'none';
            this.content.style.display = style;
        };
        Stage.prototype.setContainer = function (container) {
            if (typeof container === STRING) {
                if (container.charAt(0) === '.') {
                    var className = container.slice(1);
                    container = document.getElementsByClassName(className)[0];
                }
                else {
                    var id;
                    if (container.charAt(0) !== '#') {
                        id = container;
                    }
                    else {
                        id = container.slice(1);
                    }
                    container = document.getElementById(id);
                }
                if (!container) {
                    throw 'Can not find container in document with id ' + id;
                }
            }
            this._setAttr(CONTAINER, container);
            if (this.content) {
                if (this.content.parentElement) {
                    this.content.parentElement.removeChild(this.content);
                }
                container.appendChild(this.content);
            }
            return this;
        };
        Stage.prototype.shouldDrawHit = function () {
            return true;
        };
        Stage.prototype.clear = function () {
            var layers = this.children, len = layers.length, n;
            for (n = 0; n < len; n++) {
                layers[n].clear();
            }
            return this;
        };
        Stage.prototype.clone = function (obj) {
            if (!obj) {
                obj = {};
            }
            obj.container = document.createElement('div');
            return Container_1.Container.prototype.clone.call(this, obj);
        };
        Stage.prototype.destroy = function () {
            _super.prototype.destroy.call(this);
            var content = this.content;
            if (content && Util.Util._isInDocument(content)) {
                this.container().removeChild(content);
            }
            var index = exports.stages.indexOf(this);
            if (index > -1) {
                exports.stages.splice(index, 1);
            }
            return this;
        };
        Stage.prototype.getPointerPosition = function () {
            var pos = this._pointerPositions[0] || this._changedPointerPositions[0];
            if (!pos) {
                Util.Util.warn(NO_POINTERS_MESSAGE);
                return null;
            }
            return {
                x: pos.x,
                y: pos.y,
            };
        };
        Stage.prototype._getPointerById = function (id) {
            return this._pointerPositions.find(function (p) { return p.id === id; });
        };
        Stage.prototype.getPointersPositions = function () {
            return this._pointerPositions;
        };
        Stage.prototype.getStage = function () {
            return this;
        };
        Stage.prototype.getContent = function () {
            return this.content;
        };
        Stage.prototype._toKonvaCanvas = function (config) {
            config = config || {};
            var x = config.x || 0, y = config.y || 0, canvas = new Canvas_1.SceneCanvas({
                width: config.width || this.width(),
                height: config.height || this.height(),
                pixelRatio: config.pixelRatio || 1,
            }), _context = canvas.getContext()._context, layers = this.children;
            if (x || y) {
                _context.translate(-1 * x, -1 * y);
            }
            layers.each(function (layer) {
                if (!layer.isVisible()) {
                    return;
                }
                var layerCanvas = layer._toKonvaCanvas(config);
                _context.drawImage(layerCanvas._canvas, x, y, layerCanvas.getWidth() / layerCanvas.getPixelRatio(), layerCanvas.getHeight() / layerCanvas.getPixelRatio());
            });
            return canvas;
        };
        Stage.prototype.getIntersection = function (pos, selector) {
            if (!pos) {
                return null;
            }
            var layers = this.children, len = layers.length, end = len - 1, n, shape;
            for (n = end; n >= 0; n--) {
                shape = layers[n].getIntersection(pos, selector);
                if (shape) {
                    return shape;
                }
            }
            return null;
        };
        Stage.prototype._resizeDOM = function () {
            var width = this.width();
            var height = this.height();
            if (this.content) {
                this.content.style.width = width + PX;
                this.content.style.height = height + PX;
            }
            this.bufferCanvas.setSize(width, height);
            this.bufferHitCanvas.setSize(width, height);
            this.children.each(function (layer) {
                layer.setSize({ width: width, height: height });
                layer.draw();
            });
        };
        Stage.prototype.add = function (layer) {
            if (arguments.length > 1) {
                for (var i = 0; i < arguments.length; i++) {
                    this.add(arguments[i]);
                }
                return this;
            }
            _super.prototype.add.call(this, layer);
            var length = this.children.length;
            if (length > MAX_LAYERS_NUMBER) {
                Util.Util.warn('The stage has ' +
                    length +
                    ' layers. Recommended maximum number of layers is 3-5. Adding more layers into the stage may drop the performance. Rethink your tree structure, you can use Konva.Group.');
            }
            layer.setSize({ width: this.width(), height: this.height() });
            layer.draw();
            if (Global.Konva.isBrowser) {
                this.content.appendChild(layer.canvas._canvas);
            }
            return this;
        };
        Stage.prototype.getParent = function () {
            return null;
        };
        Stage.prototype.getLayer = function () {
            return null;
        };
        Stage.prototype.hasPointerCapture = function (pointerId) {
            return PointerEvents.hasPointerCapture(pointerId, this);
        };
        Stage.prototype.setPointerCapture = function (pointerId) {
            PointerEvents.setPointerCapture(pointerId, this);
        };
        Stage.prototype.releaseCapture = function (pointerId) {
            PointerEvents.releaseCapture(pointerId, this);
        };
        Stage.prototype.getLayers = function () {
            return this.getChildren();
        };
        Stage.prototype._bindContentEvents = function () {
            if (!Global.Konva.isBrowser) {
                return;
            }
            for (var n = 0; n < eventsLength; n++) {
                addEvent(this, EVENTS[n]);
            }
        };
        Stage.prototype._mouseenter = function (evt) {
            this.setPointersPositions(evt);
            this._fire(MOUSEENTER, { evt: evt, target: this, currentTarget: this });
        };
        Stage.prototype._mouseover = function (evt) {
            this.setPointersPositions(evt);
            this._fire(CONTENT_MOUSEOVER, { evt: evt });
            this._fire(MOUSEOVER, { evt: evt, target: this, currentTarget: this });
        };
        Stage.prototype._mouseout = function (evt) {
            var _a;
            this.setPointersPositions(evt);
            var targetShape = ((_a = this.targetShape) === null || _a === void 0 ? void 0 : _a.getStage()) ? this.targetShape : null;
            var eventsEnabled = !DragAndDrop.DD.isDragging || Global.Konva.hitOnDragEnabled;
            if (targetShape && eventsEnabled) {
                targetShape._fireAndBubble(MOUSEOUT, { evt: evt });
                targetShape._fireAndBubble(MOUSELEAVE, { evt: evt });
                this._fire(MOUSELEAVE, { evt: evt, target: this, currentTarget: this });
                this.targetShape = null;
            }
            else if (eventsEnabled) {
                this._fire(MOUSELEAVE, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                });
                this._fire(MOUSEOUT, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                });
            }
            this.pointerPos = undefined;
            this._pointerPositions = [];
            this._fire(CONTENT_MOUSEOUT, { evt: evt });
        };
        Stage.prototype._mousemove = function (evt) {
            var _a;
            if (Global.Konva.UA.ieMobile) {
                return this._touchmove(evt);
            }
            this.setPointersPositions(evt);
            var pointerId = Util.Util._getFirstPointerId(evt);
            var shape;
            var targetShape = ((_a = this.targetShape) === null || _a === void 0 ? void 0 : _a.getStage()) ? this.targetShape : null;
            var eventsEnabled = !DragAndDrop.DD.isDragging || Global.Konva.hitOnDragEnabled;
            if (eventsEnabled) {
                shape = this.getIntersection(this.getPointerPosition());
                if (shape && shape.isListening()) {
                    var differentTarget = targetShape !== shape;
                    if (eventsEnabled && differentTarget) {
                        if (targetShape) {
                            targetShape._fireAndBubble(MOUSEOUT, { evt: evt, pointerId: pointerId }, shape);
                            targetShape._fireAndBubble(MOUSELEAVE, { evt: evt, pointerId: pointerId }, shape);
                        }
                        shape._fireAndBubble(MOUSEOVER, { evt: evt, pointerId: pointerId }, targetShape);
                        shape._fireAndBubble(MOUSEENTER, { evt: evt, pointerId: pointerId }, targetShape);
                        shape._fireAndBubble(MOUSEMOVE, { evt: evt, pointerId: pointerId });
                        this.targetShape = shape;
                    }
                    else {
                        shape._fireAndBubble(MOUSEMOVE, { evt: evt, pointerId: pointerId });
                    }
                }
                else {
                    if (targetShape && eventsEnabled) {
                        targetShape._fireAndBubble(MOUSEOUT, { evt: evt, pointerId: pointerId });
                        targetShape._fireAndBubble(MOUSELEAVE, { evt: evt, pointerId: pointerId });
                        this._fire(MOUSEOVER, {
                            evt: evt,
                            target: this,
                            currentTarget: this,
                            pointerId: pointerId,
                        });
                        this.targetShape = null;
                    }
                    this._fire(MOUSEMOVE, {
                        evt: evt,
                        target: this,
                        currentTarget: this,
                        pointerId: pointerId,
                    });
                }
                this._fire(CONTENT_MOUSEMOVE, { evt: evt });
            }
            if (evt.cancelable) {
                evt.preventDefault();
            }
        };
        Stage.prototype._mousedown = function (evt) {
            if (Global.Konva.UA.ieMobile) {
                return this._touchstart(evt);
            }
            this.setPointersPositions(evt);
            var pointerId = Util.Util._getFirstPointerId(evt);
            var shape = this.getIntersection(this.getPointerPosition());
            DragAndDrop.DD.justDragged = false;
            Global.Konva.listenClickTap = true;
            if (shape && shape.isListening()) {
                this.clickStartShape = shape;
                shape._fireAndBubble(MOUSEDOWN, { evt: evt, pointerId: pointerId });
            }
            else {
                this._fire(MOUSEDOWN, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                    pointerId: pointerId,
                });
            }
            this._fire(CONTENT_MOUSEDOWN, { evt: evt });
        };
        Stage.prototype._mouseup = function (evt) {
            if (Global.Konva.UA.ieMobile) {
                return this._touchend(evt);
            }
            this.setPointersPositions(evt);
            var pointerId = Util.Util._getFirstPointerId(evt);
            var shape = this.getIntersection(this.getPointerPosition()), clickStartShape = this.clickStartShape, clickEndShape = this.clickEndShape, fireDblClick = false;
            if (Global.Konva.inDblClickWindow) {
                fireDblClick = true;
                clearTimeout(this.dblTimeout);
            }
            else if (!DragAndDrop.DD.justDragged) {
                Global.Konva.inDblClickWindow = true;
                clearTimeout(this.dblTimeout);
            }
            this.dblTimeout = setTimeout(function () {
                Global.Konva.inDblClickWindow = false;
            }, Global.Konva.dblClickWindow);
            if (shape && shape.isListening()) {
                this.clickEndShape = shape;
                shape._fireAndBubble(MOUSEUP, { evt: evt, pointerId: pointerId });
                if (Global.Konva.listenClickTap &&
                    clickStartShape &&
                    clickStartShape._id === shape._id) {
                    shape._fireAndBubble(CLICK, { evt: evt, pointerId: pointerId });
                    if (fireDblClick && clickEndShape && clickEndShape === shape) {
                        shape._fireAndBubble(DBL_CLICK, { evt: evt, pointerId: pointerId });
                    }
                }
            }
            else {
                this.clickEndShape = null;
                this._fire(MOUSEUP, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                    pointerId: pointerId,
                });
                if (Global.Konva.listenClickTap) {
                    this._fire(CLICK, {
                        evt: evt,
                        target: this,
                        currentTarget: this,
                        pointerId: pointerId,
                    });
                }
                if (fireDblClick) {
                    this._fire(DBL_CLICK, {
                        evt: evt,
                        target: this,
                        currentTarget: this,
                        pointerId: pointerId,
                    });
                }
            }
            this._fire(CONTENT_MOUSEUP, { evt: evt });
            if (Global.Konva.listenClickTap) {
                this._fire(CONTENT_CLICK, { evt: evt });
                if (fireDblClick) {
                    this._fire(CONTENT_DBL_CLICK, { evt: evt });
                }
            }
            Global.Konva.listenClickTap = false;
            if (evt.cancelable) {
                evt.preventDefault();
            }
        };
        Stage.prototype._contextmenu = function (evt) {
            this.setPointersPositions(evt);
            var shape = this.getIntersection(this.getPointerPosition());
            if (shape && shape.isListening()) {
                shape._fireAndBubble(CONTEXTMENU, { evt: evt });
            }
            else {
                this._fire(CONTEXTMENU, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                });
            }
            this._fire(CONTENT_CONTEXTMENU, { evt: evt });
        };
        Stage.prototype._touchstart = function (evt) {
            var _this = this;
            this.setPointersPositions(evt);
            var triggeredOnShape = false;
            this._changedPointerPositions.forEach(function (pos) {
                var shape = _this.getIntersection(pos);
                Global.Konva.listenClickTap = true;
                DragAndDrop.DD.justDragged = false;
                var hasShape = shape && shape.isListening();
                if (!hasShape) {
                    return;
                }
                if (Global.Konva.captureTouchEventsEnabled) {
                    shape.setPointerCapture(pos.id);
                }
                _this.tapStartShape = shape;
                shape._fireAndBubble(TOUCHSTART, { evt: evt, pointerId: pos.id }, _this);
                triggeredOnShape = true;
                if (shape.isListening() && shape.preventDefault() && evt.cancelable) {
                    evt.preventDefault();
                }
            });
            if (!triggeredOnShape) {
                this._fire(TOUCHSTART, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                    pointerId: this._changedPointerPositions[0].id,
                });
            }
            this._fire(CONTENT_TOUCHSTART, { evt: evt });
        };
        Stage.prototype._touchmove = function (evt) {
            var _this = this;
            this.setPointersPositions(evt);
            var eventsEnabled = !DragAndDrop.DD.isDragging || Global.Konva.hitOnDragEnabled;
            if (eventsEnabled) {
                var triggeredOnShape = false;
                var processedShapesIds = {};
                this._changedPointerPositions.forEach(function (pos) {
                    var shape = PointerEvents.getCapturedShape(pos.id) || _this.getIntersection(pos);
                    var hasShape = shape && shape.isListening();
                    if (!hasShape) {
                        return;
                    }
                    if (processedShapesIds[shape._id]) {
                        return;
                    }
                    processedShapesIds[shape._id] = true;
                    shape._fireAndBubble(TOUCHMOVE, { evt: evt, pointerId: pos.id });
                    triggeredOnShape = true;
                    if (shape.isListening() && shape.preventDefault() && evt.cancelable) {
                        evt.preventDefault();
                    }
                });
                if (!triggeredOnShape) {
                    this._fire(TOUCHMOVE, {
                        evt: evt,
                        target: this,
                        currentTarget: this,
                        pointerId: this._changedPointerPositions[0].id,
                    });
                }
                this._fire(CONTENT_TOUCHMOVE, { evt: evt });
            }
            if (DragAndDrop.DD.isDragging && DragAndDrop.DD.node.preventDefault() && evt.cancelable) {
                evt.preventDefault();
            }
        };
        Stage.prototype._touchend = function (evt) {
            var _this = this;
            this.setPointersPositions(evt);
            var tapEndShape = this.tapEndShape, fireDblClick = false;
            if (Global.Konva.inDblClickWindow) {
                fireDblClick = true;
                clearTimeout(this.dblTimeout);
            }
            else if (!DragAndDrop.DD.justDragged) {
                Global.Konva.inDblClickWindow = true;
                clearTimeout(this.dblTimeout);
            }
            this.dblTimeout = setTimeout(function () {
                Global.Konva.inDblClickWindow = false;
            }, Global.Konva.dblClickWindow);
            var triggeredOnShape = false;
            var processedShapesIds = {};
            var tapTriggered = false;
            var dblTapTriggered = false;
            this._changedPointerPositions.forEach(function (pos) {
                var shape = PointerEvents.getCapturedShape(pos.id) ||
                    _this.getIntersection(pos);
                if (shape) {
                    shape.releaseCapture(pos.id);
                }
                var hasShape = shape && shape.isListening();
                if (!hasShape) {
                    return;
                }
                if (processedShapesIds[shape._id]) {
                    return;
                }
                processedShapesIds[shape._id] = true;
                _this.tapEndShape = shape;
                shape._fireAndBubble(TOUCHEND, { evt: evt, pointerId: pos.id });
                triggeredOnShape = true;
                if (Global.Konva.listenClickTap && shape === _this.tapStartShape) {
                    tapTriggered = true;
                    shape._fireAndBubble(TAP, { evt: evt, pointerId: pos.id });
                    if (fireDblClick && tapEndShape && tapEndShape === shape) {
                        dblTapTriggered = true;
                        shape._fireAndBubble(DBL_TAP, { evt: evt, pointerId: pos.id });
                    }
                }
                if (shape.isListening() && shape.preventDefault() && evt.cancelable) {
                    evt.preventDefault();
                }
            });
            if (!triggeredOnShape) {
                this._fire(TOUCHEND, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                    pointerId: this._changedPointerPositions[0].id,
                });
            }
            if (Global.Konva.listenClickTap && !tapTriggered) {
                this.tapEndShape = null;
                this._fire(TAP, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                    pointerId: this._changedPointerPositions[0].id,
                });
            }
            if (fireDblClick && !dblTapTriggered) {
                this._fire(DBL_TAP, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                    pointerId: this._changedPointerPositions[0].id,
                });
            }
            this._fire(CONTENT_TOUCHEND, { evt: evt });
            if (Global.Konva.listenClickTap) {
                this._fire(CONTENT_TAP, { evt: evt });
                if (fireDblClick) {
                    this._fire(CONTENT_DBL_TAP, { evt: evt });
                }
            }
            if (this.preventDefault() && evt.cancelable) {
                evt.preventDefault();
            }
            Global.Konva.listenClickTap = false;
        };
        Stage.prototype._wheel = function (evt) {
            this.setPointersPositions(evt);
            var shape = this.getIntersection(this.getPointerPosition());
            if (shape && shape.isListening()) {
                shape._fireAndBubble(WHEEL, { evt: evt });
            }
            else {
                this._fire(WHEEL, {
                    evt: evt,
                    target: this,
                    currentTarget: this,
                });
            }
            this._fire(CONTENT_WHEEL, { evt: evt });
        };
        Stage.prototype._pointerdown = function (evt) {
            if (!Global.Konva._pointerEventsEnabled) {
                return;
            }
            this.setPointersPositions(evt);
            var shape = PointerEvents.getCapturedShape(evt.pointerId) ||
                this.getIntersection(this.getPointerPosition());
            if (shape) {
                shape._fireAndBubble(POINTERDOWN, PointerEvents.createEvent(evt));
            }
        };
        Stage.prototype._pointermove = function (evt) {
            if (!Global.Konva._pointerEventsEnabled) {
                return;
            }
            this.setPointersPositions(evt);
            var shape = PointerEvents.getCapturedShape(evt.pointerId) ||
                this.getIntersection(this.getPointerPosition());
            if (shape) {
                shape._fireAndBubble(POINTERMOVE, PointerEvents.createEvent(evt));
            }
        };
        Stage.prototype._pointerup = function (evt) {
            if (!Global.Konva._pointerEventsEnabled) {
                return;
            }
            this.setPointersPositions(evt);
            var shape = PointerEvents.getCapturedShape(evt.pointerId) ||
                this.getIntersection(this.getPointerPosition());
            if (shape) {
                shape._fireAndBubble(POINTERUP, PointerEvents.createEvent(evt));
            }
            PointerEvents.releaseCapture(evt.pointerId);
        };
        Stage.prototype._pointercancel = function (evt) {
            if (!Global.Konva._pointerEventsEnabled) {
                return;
            }
            this.setPointersPositions(evt);
            var shape = PointerEvents.getCapturedShape(evt.pointerId) ||
                this.getIntersection(this.getPointerPosition());
            if (shape) {
                shape._fireAndBubble(POINTERUP, PointerEvents.createEvent(evt));
            }
            PointerEvents.releaseCapture(evt.pointerId);
        };
        Stage.prototype._lostpointercapture = function (evt) {
            PointerEvents.releaseCapture(evt.pointerId);
        };
        Stage.prototype.setPointersPositions = function (evt) {
            var _this = this;
            var contentPosition = this._getContentPosition(), x = null, y = null;
            evt = evt ? evt : window.event;
            if (evt.touches !== undefined) {
                this._pointerPositions = [];
                this._changedPointerPositions = [];
                Util.Collection.prototype.each.call(evt.touches, function (touch) {
                    _this._pointerPositions.push({
                        id: touch.identifier,
                        x: (touch.clientX - contentPosition.left) / contentPosition.scaleX,
                        y: (touch.clientY - contentPosition.top) / contentPosition.scaleY,
                    });
                });
                Util.Collection.prototype.each.call(evt.changedTouches || evt.touches, function (touch) {
                    _this._changedPointerPositions.push({
                        id: touch.identifier,
                        x: (touch.clientX - contentPosition.left) / contentPosition.scaleX,
                        y: (touch.clientY - contentPosition.top) / contentPosition.scaleY,
                    });
                });
            }
            else {
                x = (evt.clientX - contentPosition.left) / contentPosition.scaleX;
                y = (evt.clientY - contentPosition.top) / contentPosition.scaleY;
                this.pointerPos = {
                    x: x,
                    y: y,
                };
                this._pointerPositions = [{ x: x, y: y, id: Util.Util._getFirstPointerId(evt) }];
                this._changedPointerPositions = [
                    { x: x, y: y, id: Util.Util._getFirstPointerId(evt) },
                ];
            }
        };
        Stage.prototype._setPointerPosition = function (evt) {
            Util.Util.warn('Method _setPointerPosition is deprecated. Use "stage.setPointersPositions(event)" instead.');
            this.setPointersPositions(evt);
        };
        Stage.prototype._getContentPosition = function () {
            if (!this.content || !this.content.getBoundingClientRect) {
                return {
                    top: 0,
                    left: 0,
                    scaleX: 1,
                    scaleY: 1,
                };
            }
            var rect = this.content.getBoundingClientRect();
            return {
                top: rect.top,
                left: rect.left,
                scaleX: rect.width / this.content.clientWidth || 1,
                scaleY: rect.height / this.content.clientHeight || 1,
            };
        };
        Stage.prototype._buildDOM = function () {
            this.bufferCanvas = new Canvas_1.SceneCanvas({
                width: this.width(),
                height: this.height(),
            });
            this.bufferHitCanvas = new Canvas_1.HitCanvas({
                pixelRatio: 1,
                width: this.width(),
                height: this.height(),
            });
            if (!Global.Konva.isBrowser) {
                return;
            }
            var container = this.container();
            if (!container) {
                throw 'Stage has no container. A container is required.';
            }
            container.innerHTML = EMPTY_STRING;
            this.content = document.createElement('div');
            this.content.style.position = RELATIVE;
            this.content.style.userSelect = 'none';
            this.content.className = KONVA_CONTENT;
            this.content.setAttribute('role', 'presentation');
            container.appendChild(this.content);
            this._resizeDOM();
        };
        Stage.prototype.cache = function () {
            Util.Util.warn('Cache function is not allowed for stage. You may use cache only for layers, groups and shapes.');
            return this;
        };
        Stage.prototype.clearCache = function () {
            return this;
        };
        Stage.prototype.batchDraw = function () {
            this.children.each(function (layer) {
                layer.batchDraw();
            });
            return this;
        };
        return Stage;
    }(Container_1.Container));
    exports.Stage = Stage;
    Stage.prototype.nodeType = STAGE;
    Global_2._registerNode(Stage);
    Factory.Factory.addGetterSetter(Stage, 'container');
    });

    var Shape_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });






    var HAS_SHADOW = 'hasShadow';
    var SHADOW_RGBA = 'shadowRGBA';
    var patternImage = 'patternImage';
    var linearGradient = 'linearGradient';
    var radialGradient = 'radialGradient';
    var dummyContext;
    function getDummyContext() {
        if (dummyContext) {
            return dummyContext;
        }
        dummyContext = Util.Util.createCanvasElement().getContext('2d');
        return dummyContext;
    }
    exports.shapes = {};
    function _fillFunc(context) {
        context.fill();
    }
    function _strokeFunc(context) {
        context.stroke();
    }
    function _fillFuncHit(context) {
        context.fill();
    }
    function _strokeFuncHit(context) {
        context.stroke();
    }
    function _clearHasShadowCache() {
        this._clearCache(HAS_SHADOW);
    }
    function _clearGetShadowRGBACache() {
        this._clearCache(SHADOW_RGBA);
    }
    function _clearFillPatternCache() {
        this._clearCache(patternImage);
    }
    function _clearLinearGradientCache() {
        this._clearCache(linearGradient);
    }
    function _clearRadialGradientCache() {
        this._clearCache(radialGradient);
    }
    var Shape = (function (_super) {
        __extends(Shape, _super);
        function Shape(config) {
            var _this = _super.call(this, config) || this;
            var key;
            while (true) {
                key = Util.Util.getRandomColor();
                if (key && !(key in exports.shapes)) {
                    break;
                }
            }
            _this.colorKey = key;
            exports.shapes[key] = _this;
            return _this;
        }
        Shape.prototype.getContext = function () {
            return this.getLayer().getContext();
        };
        Shape.prototype.getCanvas = function () {
            return this.getLayer().getCanvas();
        };
        Shape.prototype.getSceneFunc = function () {
            return this.attrs.sceneFunc || this['_sceneFunc'];
        };
        Shape.prototype.getHitFunc = function () {
            return this.attrs.hitFunc || this['_hitFunc'];
        };
        Shape.prototype.hasShadow = function () {
            return this._getCache(HAS_SHADOW, this._hasShadow);
        };
        Shape.prototype._hasShadow = function () {
            return (this.shadowEnabled() &&
                this.shadowOpacity() !== 0 &&
                !!(this.shadowColor() ||
                    this.shadowBlur() ||
                    this.shadowOffsetX() ||
                    this.shadowOffsetY()));
        };
        Shape.prototype._getFillPattern = function () {
            return this._getCache(patternImage, this.__getFillPattern);
        };
        Shape.prototype.__getFillPattern = function () {
            if (this.fillPatternImage()) {
                var ctx = getDummyContext();
                var pattern = ctx.createPattern(this.fillPatternImage(), this.fillPatternRepeat() || 'repeat');
                if (pattern && pattern.setTransform) {
                    pattern.setTransform({
                        a: this.fillPatternScaleX(),
                        b: 0,
                        c: 0,
                        d: this.fillPatternScaleY(),
                        e: 0,
                        f: 0,
                    });
                }
                return pattern;
            }
        };
        Shape.prototype._getLinearGradient = function () {
            return this._getCache(linearGradient, this.__getLinearGradient);
        };
        Shape.prototype.__getLinearGradient = function () {
            var colorStops = this.fillLinearGradientColorStops();
            if (colorStops) {
                var ctx = getDummyContext();
                var start = this.fillLinearGradientStartPoint();
                var end = this.fillLinearGradientEndPoint();
                var grd = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
                for (var n = 0; n < colorStops.length; n += 2) {
                    grd.addColorStop(colorStops[n], colorStops[n + 1]);
                }
                return grd;
            }
        };
        Shape.prototype._getRadialGradient = function () {
            return this._getCache(radialGradient, this.__getRadialGradient);
        };
        Shape.prototype.__getRadialGradient = function () {
            var colorStops = this.fillRadialGradientColorStops();
            if (colorStops) {
                var ctx = getDummyContext();
                var start = this.fillRadialGradientStartPoint();
                var end = this.fillRadialGradientEndPoint();
                var grd = ctx.createRadialGradient(start.x, start.y, this.fillRadialGradientStartRadius(), end.x, end.y, this.fillRadialGradientEndRadius());
                for (var n = 0; n < colorStops.length; n += 2) {
                    grd.addColorStop(colorStops[n], colorStops[n + 1]);
                }
                return grd;
            }
        };
        Shape.prototype.getShadowRGBA = function () {
            return this._getCache(SHADOW_RGBA, this._getShadowRGBA);
        };
        Shape.prototype._getShadowRGBA = function () {
            if (this.hasShadow()) {
                var rgba = Util.Util.colorToRGBA(this.shadowColor());
                return ('rgba(' +
                    rgba.r +
                    ',' +
                    rgba.g +
                    ',' +
                    rgba.b +
                    ',' +
                    rgba.a * (this.shadowOpacity() || 1) +
                    ')');
            }
        };
        Shape.prototype.hasFill = function () {
            var _this = this;
            return this._calculate('hasFill', [
                'fillEnabled',
                'fill',
                'fillPatternImage',
                'fillLinearGradientColorStops',
                'fillRadialGradientColorStops',
            ], function () {
                return (_this.fillEnabled() &&
                    !!(_this.fill() ||
                        _this.fillPatternImage() ||
                        _this.fillLinearGradientColorStops() ||
                        _this.fillRadialGradientColorStops()));
            });
        };
        Shape.prototype.hasStroke = function () {
            var _this = this;
            return this._calculate('hasStroke', [
                'strokeEnabled',
                'strokeWidth',
                'stroke',
                'strokeLinearGradientColorStops',
            ], function () {
                return (_this.strokeEnabled() &&
                    _this.strokeWidth() &&
                    !!(_this.stroke() || _this.strokeLinearGradientColorStops()));
            });
        };
        Shape.prototype.hasHitStroke = function () {
            var width = this.hitStrokeWidth();
            if (width === 'auto') {
                return this.hasStroke();
            }
            return this.strokeEnabled() && !!width;
        };
        Shape.prototype.intersects = function (point) {
            var stage = this.getStage(), bufferHitCanvas = stage.bufferHitCanvas, p;
            bufferHitCanvas.getContext().clear();
            this.drawHit(bufferHitCanvas);
            p = bufferHitCanvas.context.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data;
            return p[3] > 0;
        };
        Shape.prototype.destroy = function () {
            Node_1.Node.prototype.destroy.call(this);
            delete exports.shapes[this.colorKey];
            delete this.colorKey;
            return this;
        };
        Shape.prototype._useBufferCanvas = function (forceFill) {
            var _a;
            if (!this.getStage()) {
                return false;
            }
            var perfectDrawEnabled = (_a = this.attrs.perfectDrawEnabled) !== null && _a !== void 0 ? _a : true;
            if (!perfectDrawEnabled) {
                return false;
            }
            var hasFill = forceFill || this.hasFill();
            var hasStroke = this.hasStroke();
            var isTransparent = this.getAbsoluteOpacity() !== 1;
            if (hasFill && hasStroke && isTransparent) {
                return true;
            }
            var hasShadow = this.hasShadow();
            var strokeForShadow = this.shadowForStrokeEnabled();
            if (hasFill && hasStroke && hasShadow && strokeForShadow) {
                return true;
            }
            return false;
        };
        Shape.prototype.setStrokeHitEnabled = function (val) {
            Util.Util.warn('strokeHitEnabled property is deprecated. Please use hitStrokeWidth instead.');
            if (val) {
                this.hitStrokeWidth('auto');
            }
            else {
                this.hitStrokeWidth(0);
            }
        };
        Shape.prototype.getStrokeHitEnabled = function () {
            if (this.hitStrokeWidth() === 0) {
                return false;
            }
            else {
                return true;
            }
        };
        Shape.prototype.getSelfRect = function () {
            var size = this.size();
            return {
                x: this._centroid ? -size.width / 2 : 0,
                y: this._centroid ? -size.height / 2 : 0,
                width: size.width,
                height: size.height,
            };
        };
        Shape.prototype.getClientRect = function (attrs) {
            attrs = attrs || {};
            var skipTransform = attrs.skipTransform;
            var relativeTo = attrs.relativeTo;
            var fillRect = this.getSelfRect();
            var applyStroke = !attrs.skipStroke && this.hasStroke();
            var strokeWidth = (applyStroke && this.strokeWidth()) || 0;
            var fillAndStrokeWidth = fillRect.width + strokeWidth;
            var fillAndStrokeHeight = fillRect.height + strokeWidth;
            var applyShadow = !attrs.skipShadow && this.hasShadow();
            var shadowOffsetX = applyShadow ? this.shadowOffsetX() : 0;
            var shadowOffsetY = applyShadow ? this.shadowOffsetY() : 0;
            var preWidth = fillAndStrokeWidth + Math.abs(shadowOffsetX);
            var preHeight = fillAndStrokeHeight + Math.abs(shadowOffsetY);
            var blurRadius = (applyShadow && this.shadowBlur()) || 0;
            var width = preWidth + blurRadius * 2;
            var height = preHeight + blurRadius * 2;
            var roundingOffset = 0;
            if (Math.round(strokeWidth / 2) !== strokeWidth / 2) {
                roundingOffset = 1;
            }
            var rect = {
                width: width + roundingOffset,
                height: height + roundingOffset,
                x: -Math.round(strokeWidth / 2 + blurRadius) +
                    Math.min(shadowOffsetX, 0) +
                    fillRect.x,
                y: -Math.round(strokeWidth / 2 + blurRadius) +
                    Math.min(shadowOffsetY, 0) +
                    fillRect.y,
            };
            if (!skipTransform) {
                return this._transformedRect(rect, relativeTo);
            }
            return rect;
        };
        Shape.prototype.drawScene = function (can, top) {
            var layer = this.getLayer(), canvas = can || layer.getCanvas(), context = canvas.getContext(), cachedCanvas = this._getCanvasCache(), drawFunc = this.getSceneFunc(), hasShadow = this.hasShadow(), stage, bufferCanvas, bufferContext;
            var caching = canvas.isCache;
            var skipBuffer = canvas.isCache;
            var cachingSelf = top === this;
            if (!this.isVisible() && !caching) {
                return this;
            }
            if (cachedCanvas) {
                context.save();
                var m = this.getAbsoluteTransform(top).getMatrix();
                context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                this._drawCachedSceneCanvas(context);
                context.restore();
                return this;
            }
            if (!drawFunc) {
                return this;
            }
            context.save();
            if (this._useBufferCanvas() && !skipBuffer) {
                stage = this.getStage();
                bufferCanvas = stage.bufferCanvas;
                bufferContext = bufferCanvas.getContext();
                bufferContext.clear();
                bufferContext.save();
                bufferContext._applyLineJoin(this);
                var o = this.getAbsoluteTransform(top).getMatrix();
                bufferContext.transform(o[0], o[1], o[2], o[3], o[4], o[5]);
                drawFunc.call(this, bufferContext, this);
                bufferContext.restore();
                var ratio = bufferCanvas.pixelRatio;
                if (hasShadow) {
                    context._applyShadow(this);
                }
                context._applyOpacity(this);
                context._applyGlobalCompositeOperation(this);
                context.drawImage(bufferCanvas._canvas, 0, 0, bufferCanvas.width / ratio, bufferCanvas.height / ratio);
            }
            else {
                context._applyLineJoin(this);
                if (!cachingSelf) {
                    var o = this.getAbsoluteTransform(top).getMatrix();
                    context.transform(o[0], o[1], o[2], o[3], o[4], o[5]);
                    context._applyOpacity(this);
                    context._applyGlobalCompositeOperation(this);
                }
                if (hasShadow) {
                    context._applyShadow(this);
                }
                drawFunc.call(this, context, this);
            }
            context.restore();
            return this;
        };
        Shape.prototype.drawHit = function (can, top) {
            if (!this.shouldDrawHit(top)) {
                return this;
            }
            var layer = this.getLayer(), canvas = can || layer.hitCanvas, context = canvas && canvas.getContext(), drawFunc = this.hitFunc() || this.sceneFunc(), cachedCanvas = this._getCanvasCache(), cachedHitCanvas = cachedCanvas && cachedCanvas.hit;
            if (!this.colorKey) {
                console.log(this);
                Util.Util.warn('Looks like your canvas has a destroyed shape in it. Do not reuse shape after you destroyed it. See the shape in logs above. If you want to reuse shape you should call remove() instead of destroy()');
            }
            if (cachedHitCanvas) {
                context.save();
                var m = this.getAbsoluteTransform(top).getMatrix();
                context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                this._drawCachedHitCanvas(context);
                context.restore();
                return this;
            }
            if (!drawFunc) {
                return this;
            }
            context.save();
            context._applyLineJoin(this);
            var selfCache = this === top;
            if (!selfCache) {
                var o = this.getAbsoluteTransform(top).getMatrix();
                context.transform(o[0], o[1], o[2], o[3], o[4], o[5]);
            }
            drawFunc.call(this, context, this);
            context.restore();
            return this;
        };
        Shape.prototype.drawHitFromCache = function (alphaThreshold) {
            if (alphaThreshold === void 0) { alphaThreshold = 0; }
            var cachedCanvas = this._getCanvasCache(), sceneCanvas = this._getCachedSceneCanvas(), hitCanvas = cachedCanvas.hit, hitContext = hitCanvas.getContext(), hitWidth = hitCanvas.getWidth(), hitHeight = hitCanvas.getHeight(), hitImageData, hitData, len, rgbColorKey, i, alpha;
            hitContext.clear();
            hitContext.drawImage(sceneCanvas._canvas, 0, 0, hitWidth, hitHeight);
            try {
                hitImageData = hitContext.getImageData(0, 0, hitWidth, hitHeight);
                hitData = hitImageData.data;
                len = hitData.length;
                rgbColorKey = Util.Util._hexToRgb(this.colorKey);
                for (i = 0; i < len; i += 4) {
                    alpha = hitData[i + 3];
                    if (alpha > alphaThreshold) {
                        hitData[i] = rgbColorKey.r;
                        hitData[i + 1] = rgbColorKey.g;
                        hitData[i + 2] = rgbColorKey.b;
                        hitData[i + 3] = 255;
                    }
                    else {
                        hitData[i + 3] = 0;
                    }
                }
                hitContext.putImageData(hitImageData, 0, 0);
            }
            catch (e) {
                Util.Util.error('Unable to draw hit graph from cached scene canvas. ' + e.message);
            }
            return this;
        };
        Shape.prototype.hasPointerCapture = function (pointerId) {
            return PointerEvents.hasPointerCapture(pointerId, this);
        };
        Shape.prototype.setPointerCapture = function (pointerId) {
            PointerEvents.setPointerCapture(pointerId, this);
        };
        Shape.prototype.releaseCapture = function (pointerId) {
            PointerEvents.releaseCapture(pointerId, this);
        };
        return Shape;
    }(Node_1.Node));
    exports.Shape = Shape;
    Shape.prototype._fillFunc = _fillFunc;
    Shape.prototype._strokeFunc = _strokeFunc;
    Shape.prototype._fillFuncHit = _fillFuncHit;
    Shape.prototype._strokeFuncHit = _strokeFuncHit;
    Shape.prototype._centroid = false;
    Shape.prototype.nodeType = 'Shape';
    Global._registerNode(Shape);
    Shape.prototype.eventListeners = {};
    Shape.prototype.on.call(Shape.prototype, 'shadowColorChange.konva shadowBlurChange.konva shadowOffsetChange.konva shadowOpacityChange.konva shadowEnabledChange.konva', _clearHasShadowCache);
    Shape.prototype.on.call(Shape.prototype, 'shadowColorChange.konva shadowOpacityChange.konva shadowEnabledChange.konva', _clearGetShadowRGBACache);
    Shape.prototype.on.call(Shape.prototype, 'fillPriorityChange.konva fillPatternImageChange.konva fillPatternRepeatChange.konva fillPatternScaleXChange.konva fillPatternScaleYChange.konva', _clearFillPatternCache);
    Shape.prototype.on.call(Shape.prototype, 'fillPriorityChange.konva fillLinearGradientColorStopsChange.konva fillLinearGradientStartPointXChange.konva fillLinearGradientStartPointYChange.konva fillLinearGradientEndPointXChange.konva fillLinearGradientEndPointYChange.konva', _clearLinearGradientCache);
    Shape.prototype.on.call(Shape.prototype, 'fillPriorityChange.konva fillRadialGradientColorStopsChange.konva fillRadialGradientStartPointXChange.konva fillRadialGradientStartPointYChange.konva fillRadialGradientEndPointXChange.konva fillRadialGradientEndPointYChange.konva fillRadialGradientStartRadiusChange.konva fillRadialGradientEndRadiusChange.konva', _clearRadialGradientCache);
    Factory.Factory.addGetterSetter(Shape, 'stroke', undefined, Validators.getStringOrGradientValidator());
    Factory.Factory.addGetterSetter(Shape, 'strokeWidth', 2, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'hitStrokeWidth', 'auto', Validators.getNumberOrAutoValidator());
    Factory.Factory.addGetterSetter(Shape, 'strokeHitEnabled', true, Validators.getBooleanValidator());
    Factory.Factory.addGetterSetter(Shape, 'perfectDrawEnabled', true, Validators.getBooleanValidator());
    Factory.Factory.addGetterSetter(Shape, 'shadowForStrokeEnabled', true, Validators.getBooleanValidator());
    Factory.Factory.addGetterSetter(Shape, 'lineJoin');
    Factory.Factory.addGetterSetter(Shape, 'lineCap');
    Factory.Factory.addGetterSetter(Shape, 'sceneFunc');
    Factory.Factory.addGetterSetter(Shape, 'hitFunc');
    Factory.Factory.addGetterSetter(Shape, 'dash');
    Factory.Factory.addGetterSetter(Shape, 'dashOffset', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'shadowColor', undefined, Validators.getStringValidator());
    Factory.Factory.addGetterSetter(Shape, 'shadowBlur', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'shadowOpacity', 1, Validators.getNumberValidator());
    Factory.Factory.addComponentsGetterSetter(Shape, 'shadowOffset', ['x', 'y']);
    Factory.Factory.addGetterSetter(Shape, 'shadowOffsetX', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'shadowOffsetY', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'fillPatternImage');
    Factory.Factory.addGetterSetter(Shape, 'fill', undefined, Validators.getStringOrGradientValidator());
    Factory.Factory.addGetterSetter(Shape, 'fillPatternX', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'fillPatternY', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'fillLinearGradientColorStops');
    Factory.Factory.addGetterSetter(Shape, 'strokeLinearGradientColorStops');
    Factory.Factory.addGetterSetter(Shape, 'fillRadialGradientStartRadius', 0);
    Factory.Factory.addGetterSetter(Shape, 'fillRadialGradientEndRadius', 0);
    Factory.Factory.addGetterSetter(Shape, 'fillRadialGradientColorStops');
    Factory.Factory.addGetterSetter(Shape, 'fillPatternRepeat', 'repeat');
    Factory.Factory.addGetterSetter(Shape, 'fillEnabled', true);
    Factory.Factory.addGetterSetter(Shape, 'strokeEnabled', true);
    Factory.Factory.addGetterSetter(Shape, 'shadowEnabled', true);
    Factory.Factory.addGetterSetter(Shape, 'dashEnabled', true);
    Factory.Factory.addGetterSetter(Shape, 'strokeScaleEnabled', true);
    Factory.Factory.addGetterSetter(Shape, 'fillPriority', 'color');
    Factory.Factory.addComponentsGetterSetter(Shape, 'fillPatternOffset', ['x', 'y']);
    Factory.Factory.addGetterSetter(Shape, 'fillPatternOffsetX', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'fillPatternOffsetY', 0, Validators.getNumberValidator());
    Factory.Factory.addComponentsGetterSetter(Shape, 'fillPatternScale', ['x', 'y']);
    Factory.Factory.addGetterSetter(Shape, 'fillPatternScaleX', 1, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Shape, 'fillPatternScaleY', 1, Validators.getNumberValidator());
    Factory.Factory.addComponentsGetterSetter(Shape, 'fillLinearGradientStartPoint', [
        'x',
        'y',
    ]);
    Factory.Factory.addComponentsGetterSetter(Shape, 'strokeLinearGradientStartPoint', [
        'x',
        'y',
    ]);
    Factory.Factory.addGetterSetter(Shape, 'fillLinearGradientStartPointX', 0);
    Factory.Factory.addGetterSetter(Shape, 'strokeLinearGradientStartPointX', 0);
    Factory.Factory.addGetterSetter(Shape, 'fillLinearGradientStartPointY', 0);
    Factory.Factory.addGetterSetter(Shape, 'strokeLinearGradientStartPointY', 0);
    Factory.Factory.addComponentsGetterSetter(Shape, 'fillLinearGradientEndPoint', [
        'x',
        'y',
    ]);
    Factory.Factory.addComponentsGetterSetter(Shape, 'strokeLinearGradientEndPoint', [
        'x',
        'y',
    ]);
    Factory.Factory.addGetterSetter(Shape, 'fillLinearGradientEndPointX', 0);
    Factory.Factory.addGetterSetter(Shape, 'strokeLinearGradientEndPointX', 0);
    Factory.Factory.addGetterSetter(Shape, 'fillLinearGradientEndPointY', 0);
    Factory.Factory.addGetterSetter(Shape, 'strokeLinearGradientEndPointY', 0);
    Factory.Factory.addComponentsGetterSetter(Shape, 'fillRadialGradientStartPoint', [
        'x',
        'y',
    ]);
    Factory.Factory.addGetterSetter(Shape, 'fillRadialGradientStartPointX', 0);
    Factory.Factory.addGetterSetter(Shape, 'fillRadialGradientStartPointY', 0);
    Factory.Factory.addComponentsGetterSetter(Shape, 'fillRadialGradientEndPoint', [
        'x',
        'y',
    ]);
    Factory.Factory.addGetterSetter(Shape, 'fillRadialGradientEndPointX', 0);
    Factory.Factory.addGetterSetter(Shape, 'fillRadialGradientEndPointY', 0);
    Factory.Factory.addGetterSetter(Shape, 'fillPatternRotation', 0);
    Factory.Factory.backCompat(Shape, {
        dashArray: 'dash',
        getDashArray: 'getDash',
        setDashArray: 'getDash',
        drawFunc: 'sceneFunc',
        getDrawFunc: 'getSceneFunc',
        setDrawFunc: 'setSceneFunc',
        drawHitFunc: 'hitFunc',
        getDrawHitFunc: 'getHitFunc',
        setDrawHitFunc: 'setHitFunc',
    });
    Util.Collection.mapMethods(Shape);
    });

    var Layer_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });








    var HASH = '#', BEFORE_DRAW = 'beforeDraw', DRAW = 'draw', INTERSECTION_OFFSETS = [
        { x: 0, y: 0 },
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
    ], INTERSECTION_OFFSETS_LEN = INTERSECTION_OFFSETS.length;
    var Layer = (function (_super) {
        __extends(Layer, _super);
        function Layer(config) {
            var _this = _super.call(this, config) || this;
            _this.canvas = new Canvas_1.SceneCanvas();
            _this.hitCanvas = new Canvas_1.HitCanvas({
                pixelRatio: 1,
            });
            _this._waitingForDraw = false;
            _this.on('visibleChange.konva', _this._checkVisibility);
            _this._checkVisibility();
            _this.on('imageSmoothingEnabledChange.konva', _this._setSmoothEnabled);
            _this._setSmoothEnabled();
            return _this;
        }
        Layer.prototype.createPNGStream = function () {
            var c = this.canvas._canvas;
            return c.createPNGStream();
        };
        Layer.prototype.getCanvas = function () {
            return this.canvas;
        };
        Layer.prototype.getHitCanvas = function () {
            return this.hitCanvas;
        };
        Layer.prototype.getContext = function () {
            return this.getCanvas().getContext();
        };
        Layer.prototype.clear = function (bounds) {
            this.getContext().clear(bounds);
            this.getHitCanvas().getContext().clear(bounds);
            return this;
        };
        Layer.prototype.setZIndex = function (index) {
            _super.prototype.setZIndex.call(this, index);
            var stage = this.getStage();
            if (stage) {
                stage.content.removeChild(this.getCanvas()._canvas);
                if (index < stage.children.length - 1) {
                    stage.content.insertBefore(this.getCanvas()._canvas, stage.children[index + 1].getCanvas()._canvas);
                }
                else {
                    stage.content.appendChild(this.getCanvas()._canvas);
                }
            }
            return this;
        };
        Layer.prototype.moveToTop = function () {
            Node_1.Node.prototype.moveToTop.call(this);
            var stage = this.getStage();
            if (stage) {
                stage.content.removeChild(this.getCanvas()._canvas);
                stage.content.appendChild(this.getCanvas()._canvas);
            }
            return true;
        };
        Layer.prototype.moveUp = function () {
            var moved = Node_1.Node.prototype.moveUp.call(this);
            if (!moved) {
                return false;
            }
            var stage = this.getStage();
            if (!stage) {
                return false;
            }
            stage.content.removeChild(this.getCanvas()._canvas);
            if (this.index < stage.children.length - 1) {
                stage.content.insertBefore(this.getCanvas()._canvas, stage.children[this.index + 1].getCanvas()._canvas);
            }
            else {
                stage.content.appendChild(this.getCanvas()._canvas);
            }
            return true;
        };
        Layer.prototype.moveDown = function () {
            if (Node_1.Node.prototype.moveDown.call(this)) {
                var stage = this.getStage();
                if (stage) {
                    var children = stage.children;
                    stage.content.removeChild(this.getCanvas()._canvas);
                    stage.content.insertBefore(this.getCanvas()._canvas, children[this.index + 1].getCanvas()._canvas);
                }
                return true;
            }
            return false;
        };
        Layer.prototype.moveToBottom = function () {
            if (Node_1.Node.prototype.moveToBottom.call(this)) {
                var stage = this.getStage();
                if (stage) {
                    var children = stage.children;
                    stage.content.removeChild(this.getCanvas()._canvas);
                    stage.content.insertBefore(this.getCanvas()._canvas, children[1].getCanvas()._canvas);
                }
                return true;
            }
            return false;
        };
        Layer.prototype.getLayer = function () {
            return this;
        };
        Layer.prototype.remove = function () {
            var _canvas = this.getCanvas()._canvas;
            Node_1.Node.prototype.remove.call(this);
            if (_canvas && _canvas.parentNode && Util.Util._isInDocument(_canvas)) {
                _canvas.parentNode.removeChild(_canvas);
            }
            return this;
        };
        Layer.prototype.getStage = function () {
            return this.parent;
        };
        Layer.prototype.setSize = function (_a) {
            var width = _a.width, height = _a.height;
            this.canvas.setSize(width, height);
            this.hitCanvas.setSize(width, height);
            this._setSmoothEnabled();
            return this;
        };
        Layer.prototype._validateAdd = function (child) {
            var type = child.getType();
            if (type !== 'Group' && type !== 'Shape') {
                Util.Util.throw('You may only add groups and shapes to a layer.');
            }
        };
        Layer.prototype._toKonvaCanvas = function (config) {
            config = config || {};
            config.width = config.width || this.getWidth();
            config.height = config.height || this.getHeight();
            config.x = config.x !== undefined ? config.x : this.x();
            config.y = config.y !== undefined ? config.y : this.y();
            return Node_1.Node.prototype._toKonvaCanvas.call(this, config);
        };
        Layer.prototype._checkVisibility = function () {
            var visible = this.visible();
            if (visible) {
                this.canvas._canvas.style.display = 'block';
            }
            else {
                this.canvas._canvas.style.display = 'none';
            }
        };
        Layer.prototype._setSmoothEnabled = function () {
            this.getContext()._context.imageSmoothingEnabled = this.imageSmoothingEnabled();
        };
        Layer.prototype.getWidth = function () {
            if (this.parent) {
                return this.parent.width();
            }
        };
        Layer.prototype.setWidth = function () {
            Util.Util.warn('Can not change width of layer. Use "stage.width(value)" function instead.');
        };
        Layer.prototype.getHeight = function () {
            if (this.parent) {
                return this.parent.height();
            }
        };
        Layer.prototype.setHeight = function () {
            Util.Util.warn('Can not change height of layer. Use "stage.height(value)" function instead.');
        };
        Layer.prototype.batchDraw = function () {
            var _this = this;
            if (!this._waitingForDraw) {
                this._waitingForDraw = true;
                Util.Util.requestAnimFrame(function () {
                    _this.draw();
                    _this._waitingForDraw = false;
                });
            }
            return this;
        };
        Layer.prototype.getIntersection = function (pos, selector) {
            var obj, i, intersectionOffset, shape;
            if (!this.isListening() || !this.isVisible()) {
                return null;
            }
            var spiralSearchDistance = 1;
            var continueSearch = false;
            while (true) {
                for (i = 0; i < INTERSECTION_OFFSETS_LEN; i++) {
                    intersectionOffset = INTERSECTION_OFFSETS[i];
                    obj = this._getIntersection({
                        x: pos.x + intersectionOffset.x * spiralSearchDistance,
                        y: pos.y + intersectionOffset.y * spiralSearchDistance,
                    });
                    shape = obj.shape;
                    if (shape && selector) {
                        return shape.findAncestor(selector, true);
                    }
                    else if (shape) {
                        return shape;
                    }
                    continueSearch = !!obj.antialiased;
                    if (!obj.antialiased) {
                        break;
                    }
                }
                if (continueSearch) {
                    spiralSearchDistance += 1;
                }
                else {
                    return null;
                }
            }
        };
        Layer.prototype._getIntersection = function (pos) {
            var ratio = this.hitCanvas.pixelRatio;
            var p = this.hitCanvas.context.getImageData(Math.round(pos.x * ratio), Math.round(pos.y * ratio), 1, 1).data, p3 = p[3], colorKey, shape;
            if (p3 === 255) {
                colorKey = Util.Util._rgbToHex(p[0], p[1], p[2]);
                shape = Shape_1.shapes[HASH + colorKey];
                if (shape) {
                    return {
                        shape: shape,
                    };
                }
                return {
                    antialiased: true,
                };
            }
            else if (p3 > 0) {
                return {
                    antialiased: true,
                };
            }
            return {};
        };
        Layer.prototype.drawScene = function (can, top) {
            var layer = this.getLayer(), canvas = can || (layer && layer.getCanvas());
            this._fire(BEFORE_DRAW, {
                node: this,
            });
            if (this.clearBeforeDraw()) {
                canvas.getContext().clear();
            }
            Container_1.Container.prototype.drawScene.call(this, canvas, top);
            this._fire(DRAW, {
                node: this,
            });
            return this;
        };
        Layer.prototype.drawHit = function (can, top) {
            var layer = this.getLayer(), canvas = can || (layer && layer.hitCanvas);
            if (layer && layer.clearBeforeDraw()) {
                layer.getHitCanvas().getContext().clear();
            }
            Container_1.Container.prototype.drawHit.call(this, canvas, top);
            return this;
        };
        Layer.prototype.enableHitGraph = function () {
            this.hitGraphEnabled(true);
            return this;
        };
        Layer.prototype.disableHitGraph = function () {
            this.hitGraphEnabled(false);
            return this;
        };
        Layer.prototype.setHitGraphEnabled = function (val) {
            Util.Util.warn('hitGraphEnabled method is deprecated. Please use layer.listening() instead.');
            this.listening(val);
        };
        Layer.prototype.getHitGraphEnabled = function (val) {
            Util.Util.warn('hitGraphEnabled method is deprecated. Please use layer.listening() instead.');
            return this.listening();
        };
        Layer.prototype.toggleHitCanvas = function () {
            if (!this.parent) {
                return;
            }
            var parent = this.parent;
            var added = !!this.hitCanvas._canvas.parentNode;
            if (added) {
                parent.content.removeChild(this.hitCanvas._canvas);
            }
            else {
                parent.content.appendChild(this.hitCanvas._canvas);
            }
        };
        return Layer;
    }(Container_1.Container));
    exports.Layer = Layer;
    Layer.prototype.nodeType = 'Layer';
    Global._registerNode(Layer);
    Factory.Factory.addGetterSetter(Layer, 'imageSmoothingEnabled', true);
    Factory.Factory.addGetterSetter(Layer, 'clearBeforeDraw', true);
    Factory.Factory.addGetterSetter(Layer, 'hitGraphEnabled', true, Validators.getBooleanValidator());
    Util.Collection.mapMethods(Layer);
    });

    var FastLayer_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });



    var FastLayer = (function (_super) {
        __extends(FastLayer, _super);
        function FastLayer(attrs) {
            var _this = _super.call(this, attrs) || this;
            _this.listening(false);
            Util.Util.warn('Konva.Fast layer is deprecated. Please use "new Konva.Layer({ listening: false })" instead.');
            return _this;
        }
        return FastLayer;
    }(Layer_1.Layer));
    exports.FastLayer = FastLayer;
    FastLayer.prototype.nodeType = 'FastLayer';
    Global._registerNode(FastLayer);
    Util.Collection.mapMethods(FastLayer);
    });

    var Group_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });



    var Group = (function (_super) {
        __extends(Group, _super);
        function Group() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Group.prototype._validateAdd = function (child) {
            var type = child.getType();
            if (type !== 'Group' && type !== 'Shape') {
                Util.Util.throw('You may only add groups and shapes to groups.');
            }
        };
        return Group;
    }(Container_1.Container));
    exports.Group = Group;
    Group.prototype.nodeType = 'Group';
    Global._registerNode(Group);
    Util.Collection.mapMethods(Group);
    });

    var Animation_1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });

    var now = (function () {
        if (Global.glob.performance && Global.glob.performance.now) {
            return function () {
                return Global.glob.performance.now();
            };
        }
        return function () {
            return new Date().getTime();
        };
    })();
    var Animation = (function () {
        function Animation(func, layers) {
            this.id = Animation.animIdCounter++;
            this.frame = {
                time: 0,
                timeDiff: 0,
                lastTime: now(),
                frameRate: 0
            };
            this.func = func;
            this.setLayers(layers);
        }
        Animation.prototype.setLayers = function (layers) {
            var lays = [];
            if (!layers) {
                lays = [];
            }
            else if (layers.length > 0) {
                lays = layers;
            }
            else {
                lays = [layers];
            }
            this.layers = lays;
            return this;
        };
        Animation.prototype.getLayers = function () {
            return this.layers;
        };
        Animation.prototype.addLayer = function (layer) {
            var layers = this.layers, len = layers.length, n;
            for (n = 0; n < len; n++) {
                if (layers[n]._id === layer._id) {
                    return false;
                }
            }
            this.layers.push(layer);
            return true;
        };
        Animation.prototype.isRunning = function () {
            var a = Animation, animations = a.animations, len = animations.length, n;
            for (n = 0; n < len; n++) {
                if (animations[n].id === this.id) {
                    return true;
                }
            }
            return false;
        };
        Animation.prototype.start = function () {
            this.stop();
            this.frame.timeDiff = 0;
            this.frame.lastTime = now();
            Animation._addAnimation(this);
            return this;
        };
        Animation.prototype.stop = function () {
            Animation._removeAnimation(this);
            return this;
        };
        Animation.prototype._updateFrameObject = function (time) {
            this.frame.timeDiff = time - this.frame.lastTime;
            this.frame.lastTime = time;
            this.frame.time += this.frame.timeDiff;
            this.frame.frameRate = 1000 / this.frame.timeDiff;
        };
        Animation._addAnimation = function (anim) {
            this.animations.push(anim);
            this._handleAnimation();
        };
        Animation._removeAnimation = function (anim) {
            var id = anim.id, animations = this.animations, len = animations.length, n;
            for (n = 0; n < len; n++) {
                if (animations[n].id === id) {
                    this.animations.splice(n, 1);
                    break;
                }
            }
        };
        Animation._runFrames = function () {
            var layerHash = {}, animations = this.animations, anim, layers, func, n, i, layersLen, layer, key, needRedraw;
            for (n = 0; n < animations.length; n++) {
                anim = animations[n];
                layers = anim.layers;
                func = anim.func;
                anim._updateFrameObject(now());
                layersLen = layers.length;
                if (func) {
                    needRedraw = func.call(anim, anim.frame) !== false;
                }
                else {
                    needRedraw = true;
                }
                if (!needRedraw) {
                    continue;
                }
                for (i = 0; i < layersLen; i++) {
                    layer = layers[i];
                    if (layer._id !== undefined) {
                        layerHash[layer._id] = layer;
                    }
                }
            }
            for (key in layerHash) {
                if (!layerHash.hasOwnProperty(key)) {
                    continue;
                }
                layerHash[key].draw();
            }
        };
        Animation._animationLoop = function () {
            var Anim = Animation;
            if (Anim.animations.length) {
                Anim._runFrames();
                requestAnimationFrame(Anim._animationLoop);
            }
            else {
                Anim.animRunning = false;
            }
        };
        Animation._handleAnimation = function () {
            if (!this.animRunning) {
                this.animRunning = true;
                requestAnimationFrame(this._animationLoop);
            }
        };
        Animation.animations = [];
        Animation.animIdCounter = 0;
        Animation.animRunning = false;
        return Animation;
    }());
    exports.Animation = Animation;
    });

    var Tween_1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });




    var blacklist = {
        node: 1,
        duration: 1,
        easing: 1,
        onFinish: 1,
        yoyo: 1,
    }, PAUSED = 1, PLAYING = 2, REVERSING = 3, idCounter = 0, colorAttrs = ['fill', 'stroke', 'shadowColor'];
    var TweenEngine = (function () {
        function TweenEngine(prop, propFunc, func, begin, finish, duration, yoyo) {
            this.prop = prop;
            this.propFunc = propFunc;
            this.begin = begin;
            this._pos = begin;
            this.duration = duration;
            this._change = 0;
            this.prevPos = 0;
            this.yoyo = yoyo;
            this._time = 0;
            this._position = 0;
            this._startTime = 0;
            this._finish = 0;
            this.func = func;
            this._change = finish - this.begin;
            this.pause();
        }
        TweenEngine.prototype.fire = function (str) {
            var handler = this[str];
            if (handler) {
                handler();
            }
        };
        TweenEngine.prototype.setTime = function (t) {
            if (t > this.duration) {
                if (this.yoyo) {
                    this._time = this.duration;
                    this.reverse();
                }
                else {
                    this.finish();
                }
            }
            else if (t < 0) {
                if (this.yoyo) {
                    this._time = 0;
                    this.play();
                }
                else {
                    this.reset();
                }
            }
            else {
                this._time = t;
                this.update();
            }
        };
        TweenEngine.prototype.getTime = function () {
            return this._time;
        };
        TweenEngine.prototype.setPosition = function (p) {
            this.prevPos = this._pos;
            this.propFunc(p);
            this._pos = p;
        };
        TweenEngine.prototype.getPosition = function (t) {
            if (t === undefined) {
                t = this._time;
            }
            return this.func(t, this.begin, this._change, this.duration);
        };
        TweenEngine.prototype.play = function () {
            this.state = PLAYING;
            this._startTime = this.getTimer() - this._time;
            this.onEnterFrame();
            this.fire('onPlay');
        };
        TweenEngine.prototype.reverse = function () {
            this.state = REVERSING;
            this._time = this.duration - this._time;
            this._startTime = this.getTimer() - this._time;
            this.onEnterFrame();
            this.fire('onReverse');
        };
        TweenEngine.prototype.seek = function (t) {
            this.pause();
            this._time = t;
            this.update();
            this.fire('onSeek');
        };
        TweenEngine.prototype.reset = function () {
            this.pause();
            this._time = 0;
            this.update();
            this.fire('onReset');
        };
        TweenEngine.prototype.finish = function () {
            this.pause();
            this._time = this.duration;
            this.update();
            this.fire('onFinish');
        };
        TweenEngine.prototype.update = function () {
            this.setPosition(this.getPosition(this._time));
            this.fire('onUpdate');
        };
        TweenEngine.prototype.onEnterFrame = function () {
            var t = this.getTimer() - this._startTime;
            if (this.state === PLAYING) {
                this.setTime(t);
            }
            else if (this.state === REVERSING) {
                this.setTime(this.duration - t);
            }
        };
        TweenEngine.prototype.pause = function () {
            this.state = PAUSED;
            this.fire('onPause');
        };
        TweenEngine.prototype.getTimer = function () {
            return new Date().getTime();
        };
        return TweenEngine;
    }());
    var Tween = (function () {
        function Tween(config) {
            var that = this, node = config.node, nodeId = node._id, duration, easing = config.easing || exports.Easings.Linear, yoyo = !!config.yoyo, key;
            if (typeof config.duration === 'undefined') {
                duration = 0.3;
            }
            else if (config.duration === 0) {
                duration = 0.001;
            }
            else {
                duration = config.duration;
            }
            this.node = node;
            this._id = idCounter++;
            var layers = node.getLayer() ||
                (node instanceof Global.Konva['Stage'] ? node.getLayers() : null);
            if (!layers) {
                Util.Util.error('Tween constructor have `node` that is not in a layer. Please add node into layer first.');
            }
            this.anim = new Animation_1.Animation(function () {
                that.tween.onEnterFrame();
            }, layers);
            this.tween = new TweenEngine(key, function (i) {
                that._tweenFunc(i);
            }, easing, 0, 1, duration * 1000, yoyo);
            this._addListeners();
            if (!Tween.attrs[nodeId]) {
                Tween.attrs[nodeId] = {};
            }
            if (!Tween.attrs[nodeId][this._id]) {
                Tween.attrs[nodeId][this._id] = {};
            }
            if (!Tween.tweens[nodeId]) {
                Tween.tweens[nodeId] = {};
            }
            for (key in config) {
                if (blacklist[key] === undefined) {
                    this._addAttr(key, config[key]);
                }
            }
            this.reset();
            this.onFinish = config.onFinish;
            this.onReset = config.onReset;
            this.onUpdate = config.onUpdate;
        }
        Tween.prototype._addAttr = function (key, end) {
            var node = this.node, nodeId = node._id, start, diff, tweenId, n, len, trueEnd, trueStart, endRGBA;
            tweenId = Tween.tweens[nodeId][key];
            if (tweenId) {
                delete Tween.attrs[nodeId][tweenId][key];
            }
            start = node.getAttr(key);
            if (Util.Util._isArray(end)) {
                diff = [];
                len = Math.max(end.length, start.length);
                if (key === 'points' && end.length !== start.length) {
                    if (end.length > start.length) {
                        trueStart = start;
                        start = Util.Util._prepareArrayForTween(start, end, node.closed());
                    }
                    else {
                        trueEnd = end;
                        end = Util.Util._prepareArrayForTween(end, start, node.closed());
                    }
                }
                if (key.indexOf('fill') === 0) {
                    for (n = 0; n < len; n++) {
                        if (n % 2 === 0) {
                            diff.push(end[n] - start[n]);
                        }
                        else {
                            var startRGBA = Util.Util.colorToRGBA(start[n]);
                            endRGBA = Util.Util.colorToRGBA(end[n]);
                            start[n] = startRGBA;
                            diff.push({
                                r: endRGBA.r - startRGBA.r,
                                g: endRGBA.g - startRGBA.g,
                                b: endRGBA.b - startRGBA.b,
                                a: endRGBA.a - startRGBA.a,
                            });
                        }
                    }
                }
                else {
                    for (n = 0; n < len; n++) {
                        diff.push(end[n] - start[n]);
                    }
                }
            }
            else if (colorAttrs.indexOf(key) !== -1) {
                start = Util.Util.colorToRGBA(start);
                endRGBA = Util.Util.colorToRGBA(end);
                diff = {
                    r: endRGBA.r - start.r,
                    g: endRGBA.g - start.g,
                    b: endRGBA.b - start.b,
                    a: endRGBA.a - start.a,
                };
            }
            else {
                diff = end - start;
            }
            Tween.attrs[nodeId][this._id][key] = {
                start: start,
                diff: diff,
                end: end,
                trueEnd: trueEnd,
                trueStart: trueStart,
            };
            Tween.tweens[nodeId][key] = this._id;
        };
        Tween.prototype._tweenFunc = function (i) {
            var node = this.node, attrs = Tween.attrs[node._id][this._id], key, attr, start, diff, newVal, n, len, end;
            for (key in attrs) {
                attr = attrs[key];
                start = attr.start;
                diff = attr.diff;
                end = attr.end;
                if (Util.Util._isArray(start)) {
                    newVal = [];
                    len = Math.max(start.length, end.length);
                    if (key.indexOf('fill') === 0) {
                        for (n = 0; n < len; n++) {
                            if (n % 2 === 0) {
                                newVal.push((start[n] || 0) + diff[n] * i);
                            }
                            else {
                                newVal.push('rgba(' +
                                    Math.round(start[n].r + diff[n].r * i) +
                                    ',' +
                                    Math.round(start[n].g + diff[n].g * i) +
                                    ',' +
                                    Math.round(start[n].b + diff[n].b * i) +
                                    ',' +
                                    (start[n].a + diff[n].a * i) +
                                    ')');
                            }
                        }
                    }
                    else {
                        for (n = 0; n < len; n++) {
                            newVal.push((start[n] || 0) + diff[n] * i);
                        }
                    }
                }
                else if (colorAttrs.indexOf(key) !== -1) {
                    newVal =
                        'rgba(' +
                            Math.round(start.r + diff.r * i) +
                            ',' +
                            Math.round(start.g + diff.g * i) +
                            ',' +
                            Math.round(start.b + diff.b * i) +
                            ',' +
                            (start.a + diff.a * i) +
                            ')';
                }
                else {
                    newVal = start + diff * i;
                }
                node.setAttr(key, newVal);
            }
        };
        Tween.prototype._addListeners = function () {
            var _this = this;
            this.tween.onPlay = function () {
                _this.anim.start();
            };
            this.tween.onReverse = function () {
                _this.anim.start();
            };
            this.tween.onPause = function () {
                _this.anim.stop();
            };
            this.tween.onFinish = function () {
                var node = _this.node;
                var attrs = Tween.attrs[node._id][_this._id];
                if (attrs.points && attrs.points.trueEnd) {
                    node.setAttr('points', attrs.points.trueEnd);
                }
                if (_this.onFinish) {
                    _this.onFinish.call(_this);
                }
            };
            this.tween.onReset = function () {
                var node = _this.node;
                var attrs = Tween.attrs[node._id][_this._id];
                if (attrs.points && attrs.points.trueStart) {
                    node.points(attrs.points.trueStart);
                }
                if (_this.onReset) {
                    _this.onReset();
                }
            };
            this.tween.onUpdate = function () {
                if (_this.onUpdate) {
                    _this.onUpdate.call(_this);
                }
            };
        };
        Tween.prototype.play = function () {
            this.tween.play();
            return this;
        };
        Tween.prototype.reverse = function () {
            this.tween.reverse();
            return this;
        };
        Tween.prototype.reset = function () {
            this.tween.reset();
            return this;
        };
        Tween.prototype.seek = function (t) {
            this.tween.seek(t * 1000);
            return this;
        };
        Tween.prototype.pause = function () {
            this.tween.pause();
            return this;
        };
        Tween.prototype.finish = function () {
            this.tween.finish();
            return this;
        };
        Tween.prototype.destroy = function () {
            var nodeId = this.node._id, thisId = this._id, attrs = Tween.tweens[nodeId], key;
            this.pause();
            for (key in attrs) {
                delete Tween.tweens[nodeId][key];
            }
            delete Tween.attrs[nodeId][thisId];
        };
        Tween.attrs = {};
        Tween.tweens = {};
        return Tween;
    }());
    exports.Tween = Tween;
    Node_1.Node.prototype.to = function (params) {
        var onFinish = params.onFinish;
        params.node = this;
        params.onFinish = function () {
            this.destroy();
            if (onFinish) {
                onFinish();
            }
        };
        var tween = new Tween(params);
        tween.play();
    };
    exports.Easings = {
        BackEaseIn: function (t, b, c, d) {
            var s = 1.70158;
            return c * (t /= d) * t * ((s + 1) * t - s) + b;
        },
        BackEaseOut: function (t, b, c, d) {
            var s = 1.70158;
            return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
        },
        BackEaseInOut: function (t, b, c, d) {
            var s = 1.70158;
            if ((t /= d / 2) < 1) {
                return (c / 2) * (t * t * (((s *= 1.525) + 1) * t - s)) + b;
            }
            return (c / 2) * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2) + b;
        },
        ElasticEaseIn: function (t, b, c, d, a, p) {
            var s = 0;
            if (t === 0) {
                return b;
            }
            if ((t /= d) === 1) {
                return b + c;
            }
            if (!p) {
                p = d * 0.3;
            }
            if (!a || a < Math.abs(c)) {
                a = c;
                s = p / 4;
            }
            else {
                s = (p / (2 * Math.PI)) * Math.asin(c / a);
            }
            return (-(a *
                Math.pow(2, 10 * (t -= 1)) *
                Math.sin(((t * d - s) * (2 * Math.PI)) / p)) + b);
        },
        ElasticEaseOut: function (t, b, c, d, a, p) {
            var s = 0;
            if (t === 0) {
                return b;
            }
            if ((t /= d) === 1) {
                return b + c;
            }
            if (!p) {
                p = d * 0.3;
            }
            if (!a || a < Math.abs(c)) {
                a = c;
                s = p / 4;
            }
            else {
                s = (p / (2 * Math.PI)) * Math.asin(c / a);
            }
            return (a * Math.pow(2, -10 * t) * Math.sin(((t * d - s) * (2 * Math.PI)) / p) +
                c +
                b);
        },
        ElasticEaseInOut: function (t, b, c, d, a, p) {
            var s = 0;
            if (t === 0) {
                return b;
            }
            if ((t /= d / 2) === 2) {
                return b + c;
            }
            if (!p) {
                p = d * (0.3 * 1.5);
            }
            if (!a || a < Math.abs(c)) {
                a = c;
                s = p / 4;
            }
            else {
                s = (p / (2 * Math.PI)) * Math.asin(c / a);
            }
            if (t < 1) {
                return (-0.5 *
                    (a *
                        Math.pow(2, 10 * (t -= 1)) *
                        Math.sin(((t * d - s) * (2 * Math.PI)) / p)) +
                    b);
            }
            return (a *
                Math.pow(2, -10 * (t -= 1)) *
                Math.sin(((t * d - s) * (2 * Math.PI)) / p) *
                0.5 +
                c +
                b);
        },
        BounceEaseOut: function (t, b, c, d) {
            if ((t /= d) < 1 / 2.75) {
                return c * (7.5625 * t * t) + b;
            }
            else if (t < 2 / 2.75) {
                return c * (7.5625 * (t -= 1.5 / 2.75) * t + 0.75) + b;
            }
            else if (t < 2.5 / 2.75) {
                return c * (7.5625 * (t -= 2.25 / 2.75) * t + 0.9375) + b;
            }
            else {
                return c * (7.5625 * (t -= 2.625 / 2.75) * t + 0.984375) + b;
            }
        },
        BounceEaseIn: function (t, b, c, d) {
            return c - exports.Easings.BounceEaseOut(d - t, 0, c, d) + b;
        },
        BounceEaseInOut: function (t, b, c, d) {
            if (t < d / 2) {
                return exports.Easings.BounceEaseIn(t * 2, 0, c, d) * 0.5 + b;
            }
            else {
                return exports.Easings.BounceEaseOut(t * 2 - d, 0, c, d) * 0.5 + c * 0.5 + b;
            }
        },
        EaseIn: function (t, b, c, d) {
            return c * (t /= d) * t + b;
        },
        EaseOut: function (t, b, c, d) {
            return -c * (t /= d) * (t - 2) + b;
        },
        EaseInOut: function (t, b, c, d) {
            if ((t /= d / 2) < 1) {
                return (c / 2) * t * t + b;
            }
            return (-c / 2) * (--t * (t - 2) - 1) + b;
        },
        StrongEaseIn: function (t, b, c, d) {
            return c * (t /= d) * t * t * t * t + b;
        },
        StrongEaseOut: function (t, b, c, d) {
            return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
        },
        StrongEaseInOut: function (t, b, c, d) {
            if ((t /= d / 2) < 1) {
                return (c / 2) * t * t * t * t * t + b;
            }
            return (c / 2) * ((t -= 2) * t * t * t * t + 2) + b;
        },
        Linear: function (t, b, c, d) {
            return (c * t) / d + b;
        },
    };
    });

    var _CoreInternals = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });














    exports.Konva = Util.Util._assign(Global.Konva, {
        Collection: Util.Collection,
        Util: Util.Util,
        Transform: Util.Transform,
        Node: Node_1.Node,
        ids: Node_1.ids,
        names: Node_1.names,
        Container: Container_1.Container,
        Stage: Stage_1.Stage,
        stages: Stage_1.stages,
        Layer: Layer_1.Layer,
        FastLayer: FastLayer_1.FastLayer,
        Group: Group_1.Group,
        DD: DragAndDrop.DD,
        Shape: Shape_1.Shape,
        shapes: Shape_1.shapes,
        Animation: Animation_1.Animation,
        Tween: Tween_1.Tween,
        Easings: Tween_1.Easings,
        Context: Context_1.Context,
        Canvas: Canvas_1.Canvas
    });
    });

    var Arc_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Global_2 = Global;
    var Arc = (function (_super) {
        __extends(Arc, _super);
        function Arc() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Arc.prototype._sceneFunc = function (context) {
            var angle = Global.Konva.getAngle(this.angle()), clockwise = this.clockwise();
            context.beginPath();
            context.arc(0, 0, this.outerRadius(), 0, angle, clockwise);
            context.arc(0, 0, this.innerRadius(), angle, 0, !clockwise);
            context.closePath();
            context.fillStrokeShape(this);
        };
        Arc.prototype.getWidth = function () {
            return this.outerRadius() * 2;
        };
        Arc.prototype.getHeight = function () {
            return this.outerRadius() * 2;
        };
        Arc.prototype.setWidth = function (width) {
            this.outerRadius(width / 2);
        };
        Arc.prototype.setHeight = function (height) {
            this.outerRadius(height / 2);
        };
        return Arc;
    }(Shape_1.Shape));
    exports.Arc = Arc;
    Arc.prototype._centroid = true;
    Arc.prototype.className = 'Arc';
    Arc.prototype._attrsAffectingSize = ['innerRadius', 'outerRadius'];
    Global_2._registerNode(Arc);
    Factory.Factory.addGetterSetter(Arc, 'innerRadius', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Arc, 'outerRadius', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Arc, 'angle', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Arc, 'clockwise', false, Validators.getBooleanValidator());
    Util.Collection.mapMethods(Arc);
    });

    var Line_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __spreadArrays = (commonjsGlobal && commonjsGlobal.__spreadArrays) || function () {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    };
    Object.defineProperty(exports, "__esModule", { value: true });





    var Line = (function (_super) {
        __extends(Line, _super);
        function Line(config) {
            var _this = _super.call(this, config) || this;
            _this.on('pointsChange.konva tensionChange.konva closedChange.konva bezierChange.konva', function () {
                this._clearCache('tensionPoints');
            });
            return _this;
        }
        Line.prototype._sceneFunc = function (context) {
            var points = this.points(), length = points.length, tension = this.tension(), closed = this.closed(), bezier = this.bezier(), tp, len, n;
            if (!length) {
                return;
            }
            context.beginPath();
            context.moveTo(points[0], points[1]);
            if (tension !== 0 && length > 4) {
                tp = this.getTensionPoints();
                len = tp.length;
                n = closed ? 0 : 4;
                if (!closed) {
                    context.quadraticCurveTo(tp[0], tp[1], tp[2], tp[3]);
                }
                while (n < len - 2) {
                    context.bezierCurveTo(tp[n++], tp[n++], tp[n++], tp[n++], tp[n++], tp[n++]);
                }
                if (!closed) {
                    context.quadraticCurveTo(tp[len - 2], tp[len - 1], points[length - 2], points[length - 1]);
                }
            }
            else if (bezier) {
                n = 2;
                while (n < length) {
                    context.bezierCurveTo(points[n++], points[n++], points[n++], points[n++], points[n++], points[n++]);
                }
            }
            else {
                for (n = 2; n < length; n += 2) {
                    context.lineTo(points[n], points[n + 1]);
                }
            }
            if (closed) {
                context.closePath();
                context.fillStrokeShape(this);
            }
            else {
                context.strokeShape(this);
            }
        };
        Line.prototype.getTensionPoints = function () {
            return this._getCache('tensionPoints', this._getTensionPoints);
        };
        Line.prototype._getTensionPoints = function () {
            if (this.closed()) {
                return this._getTensionPointsClosed();
            }
            else {
                return Util.Util._expandPoints(this.points(), this.tension());
            }
        };
        Line.prototype._getTensionPointsClosed = function () {
            var p = this.points(), len = p.length, tension = this.tension(), firstControlPoints = Util.Util._getControlPoints(p[len - 2], p[len - 1], p[0], p[1], p[2], p[3], tension), lastControlPoints = Util.Util._getControlPoints(p[len - 4], p[len - 3], p[len - 2], p[len - 1], p[0], p[1], tension), middle = Util.Util._expandPoints(p, tension), tp = [firstControlPoints[2], firstControlPoints[3]]
                .concat(middle)
                .concat([
                lastControlPoints[0],
                lastControlPoints[1],
                p[len - 2],
                p[len - 1],
                lastControlPoints[2],
                lastControlPoints[3],
                firstControlPoints[0],
                firstControlPoints[1],
                p[0],
                p[1]
            ]);
            return tp;
        };
        Line.prototype.getWidth = function () {
            return this.getSelfRect().width;
        };
        Line.prototype.getHeight = function () {
            return this.getSelfRect().height;
        };
        Line.prototype.getSelfRect = function () {
            var points = this.points();
            if (points.length < 4) {
                return {
                    x: points[0] || 0,
                    y: points[1] || 0,
                    width: 0,
                    height: 0
                };
            }
            if (this.tension() !== 0) {
                points = __spreadArrays([
                    points[0],
                    points[1]
                ], this._getTensionPoints(), [
                    points[points.length - 2],
                    points[points.length - 1]
                ]);
            }
            else {
                points = this.points();
            }
            var minX = points[0];
            var maxX = points[0];
            var minY = points[1];
            var maxY = points[1];
            var x, y;
            for (var i = 0; i < points.length / 2; i++) {
                x = points[i * 2];
                y = points[i * 2 + 1];
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        };
        return Line;
    }(Shape_1.Shape));
    exports.Line = Line;
    Line.prototype.className = 'Line';
    Line.prototype._attrsAffectingSize = ['points', 'bezier', 'tension'];
    Global._registerNode(Line);
    Factory.Factory.addGetterSetter(Line, 'closed', false);
    Factory.Factory.addGetterSetter(Line, 'bezier', false);
    Factory.Factory.addGetterSetter(Line, 'tension', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Line, 'points', [], Validators.getNumberArrayValidator());
    Util.Collection.mapMethods(Line);
    });

    var Arrow_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Arrow = (function (_super) {
        __extends(Arrow, _super);
        function Arrow() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Arrow.prototype._sceneFunc = function (ctx) {
            _super.prototype._sceneFunc.call(this, ctx);
            var PI2 = Math.PI * 2;
            var points = this.points();
            var tp = points;
            var fromTension = this.tension() !== 0 && points.length > 4;
            if (fromTension) {
                tp = this.getTensionPoints();
            }
            var n = points.length;
            var dx, dy;
            if (fromTension) {
                dx = points[n - 2] - (tp[tp.length - 2] + tp[tp.length - 4]) / 2;
                dy = points[n - 1] - (tp[tp.length - 1] + tp[tp.length - 3]) / 2;
            }
            else {
                dx = points[n - 2] - points[n - 4];
                dy = points[n - 1] - points[n - 3];
            }
            var radians = (Math.atan2(dy, dx) + PI2) % PI2;
            var length = this.pointerLength();
            var width = this.pointerWidth();
            ctx.save();
            ctx.beginPath();
            ctx.translate(points[n - 2], points[n - 1]);
            ctx.rotate(radians);
            ctx.moveTo(0, 0);
            ctx.lineTo(-length, width / 2);
            ctx.lineTo(-length, -width / 2);
            ctx.closePath();
            ctx.restore();
            if (this.pointerAtBeginning()) {
                ctx.save();
                ctx.translate(points[0], points[1]);
                if (fromTension) {
                    dx = (tp[0] + tp[2]) / 2 - points[0];
                    dy = (tp[1] + tp[3]) / 2 - points[1];
                }
                else {
                    dx = points[2] - points[0];
                    dy = points[3] - points[1];
                }
                ctx.rotate((Math.atan2(-dy, -dx) + PI2) % PI2);
                ctx.moveTo(0, 0);
                ctx.lineTo(-length, width / 2);
                ctx.lineTo(-length, -width / 2);
                ctx.closePath();
                ctx.restore();
            }
            var isDashEnabled = this.dashEnabled();
            if (isDashEnabled) {
                this.attrs.dashEnabled = false;
                ctx.setLineDash([]);
            }
            ctx.fillStrokeShape(this);
            if (isDashEnabled) {
                this.attrs.dashEnabled = true;
            }
        };
        Arrow.prototype.getSelfRect = function () {
            var lineRect = _super.prototype.getSelfRect.call(this);
            var offset = this.pointerWidth() / 2;
            return {
                x: lineRect.x - offset,
                y: lineRect.y - offset,
                width: lineRect.width + offset * 2,
                height: lineRect.height + offset * 2
            };
        };
        return Arrow;
    }(Line_1.Line));
    exports.Arrow = Arrow;
    Arrow.prototype.className = 'Arrow';
    Global._registerNode(Arrow);
    Factory.Factory.addGetterSetter(Arrow, 'pointerLength', 10, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Arrow, 'pointerWidth', 10, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Arrow, 'pointerAtBeginning', false);
    Util.Collection.mapMethods(Arrow);
    });

    var Circle_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Circle = (function (_super) {
        __extends(Circle, _super);
        function Circle() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Circle.prototype._sceneFunc = function (context) {
            context.beginPath();
            context.arc(0, 0, this.attrs.radius || 0, 0, Math.PI * 2, false);
            context.closePath();
            context.fillStrokeShape(this);
        };
        Circle.prototype.getWidth = function () {
            return this.radius() * 2;
        };
        Circle.prototype.getHeight = function () {
            return this.radius() * 2;
        };
        Circle.prototype.setWidth = function (width) {
            if (this.radius() !== width / 2) {
                this.radius(width / 2);
            }
        };
        Circle.prototype.setHeight = function (height) {
            if (this.radius() !== height / 2) {
                this.radius(height / 2);
            }
        };
        return Circle;
    }(Shape_1.Shape));
    exports.Circle = Circle;
    Circle.prototype._centroid = true;
    Circle.prototype.className = 'Circle';
    Circle.prototype._attrsAffectingSize = ['radius'];
    Global._registerNode(Circle);
    Factory.Factory.addGetterSetter(Circle, 'radius', 0, Validators.getNumberValidator());
    Util.Collection.mapMethods(Circle);
    });

    var Ellipse_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Ellipse = (function (_super) {
        __extends(Ellipse, _super);
        function Ellipse() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Ellipse.prototype._sceneFunc = function (context) {
            var rx = this.radiusX(), ry = this.radiusY();
            context.beginPath();
            context.save();
            if (rx !== ry) {
                context.scale(1, ry / rx);
            }
            context.arc(0, 0, rx, 0, Math.PI * 2, false);
            context.restore();
            context.closePath();
            context.fillStrokeShape(this);
        };
        Ellipse.prototype.getWidth = function () {
            return this.radiusX() * 2;
        };
        Ellipse.prototype.getHeight = function () {
            return this.radiusY() * 2;
        };
        Ellipse.prototype.setWidth = function (width) {
            this.radiusX(width / 2);
        };
        Ellipse.prototype.setHeight = function (height) {
            this.radiusY(height / 2);
        };
        return Ellipse;
    }(Shape_1.Shape));
    exports.Ellipse = Ellipse;
    Ellipse.prototype.className = 'Ellipse';
    Ellipse.prototype._centroid = true;
    Ellipse.prototype._attrsAffectingSize = ['radiusX', 'radiusY'];
    Global._registerNode(Ellipse);
    Factory.Factory.addComponentsGetterSetter(Ellipse, 'radius', ['x', 'y']);
    Factory.Factory.addGetterSetter(Ellipse, 'radiusX', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Ellipse, 'radiusY', 0, Validators.getNumberValidator());
    Util.Collection.mapMethods(Ellipse);
    });

    var Image_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Image = (function (_super) {
        __extends(Image, _super);
        function Image() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Image.prototype._useBufferCanvas = function () {
            return _super.prototype._useBufferCanvas.call(this, true);
        };
        Image.prototype._sceneFunc = function (context) {
            var width = this.getWidth(), height = this.getHeight(), image = this.attrs.image, cropWidth, cropHeight, params;
            if (image) {
                cropWidth = this.attrs.cropWidth;
                cropHeight = this.attrs.cropHeight;
                if (cropWidth && cropHeight) {
                    params = [
                        image,
                        this.cropX(),
                        this.cropY(),
                        cropWidth,
                        cropHeight,
                        0,
                        0,
                        width,
                        height,
                    ];
                }
                else {
                    params = [image, 0, 0, width, height];
                }
            }
            if (this.hasFill() || this.hasStroke()) {
                context.beginPath();
                context.rect(0, 0, width, height);
                context.closePath();
                context.fillStrokeShape(this);
            }
            if (image) {
                context.drawImage.apply(context, params);
            }
        };
        Image.prototype._hitFunc = function (context) {
            var width = this.width(), height = this.height();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        };
        Image.prototype.getWidth = function () {
            var _a, _b;
            return (_a = this.attrs.width) !== null && _a !== void 0 ? _a : (((_b = this.image()) === null || _b === void 0 ? void 0 : _b.width) || 0);
        };
        Image.prototype.getHeight = function () {
            var _a, _b;
            return (_a = this.attrs.height) !== null && _a !== void 0 ? _a : (((_b = this.image()) === null || _b === void 0 ? void 0 : _b.height) || 0);
        };
        Image.fromURL = function (url, callback) {
            var img = Util.Util.createImageElement();
            img.onload = function () {
                var image = new Image({
                    image: img,
                });
                callback(image);
            };
            img.crossOrigin = 'Anonymous';
            img.src = url;
        };
        return Image;
    }(Shape_1.Shape));
    exports.Image = Image;
    Image.prototype.className = 'Image';
    Global._registerNode(Image);
    Factory.Factory.addGetterSetter(Image, 'image');
    Factory.Factory.addComponentsGetterSetter(Image, 'crop', ['x', 'y', 'width', 'height']);
    Factory.Factory.addGetterSetter(Image, 'cropX', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Image, 'cropY', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Image, 'cropWidth', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Image, 'cropHeight', 0, Validators.getNumberValidator());
    Util.Collection.mapMethods(Image);
    });

    var Label_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });






    var ATTR_CHANGE_LIST = [
        'fontFamily',
        'fontSize',
        'fontStyle',
        'padding',
        'lineHeight',
        'text',
        'width'
    ], CHANGE_KONVA = 'Change.konva', NONE = 'none', UP = 'up', RIGHT = 'right', DOWN = 'down', LEFT = 'left', attrChangeListLen = ATTR_CHANGE_LIST.length;
    var Label = (function (_super) {
        __extends(Label, _super);
        function Label(config) {
            var _this = _super.call(this, config) || this;
            _this.on('add.konva', function (evt) {
                this._addListeners(evt.child);
                this._sync();
            });
            return _this;
        }
        Label.prototype.getText = function () {
            return this.find('Text')[0];
        };
        Label.prototype.getTag = function () {
            return this.find('Tag')[0];
        };
        Label.prototype._addListeners = function (text) {
            var that = this, n;
            var func = function () {
                that._sync();
            };
            for (n = 0; n < attrChangeListLen; n++) {
                text.on(ATTR_CHANGE_LIST[n] + CHANGE_KONVA, func);
            }
        };
        Label.prototype.getWidth = function () {
            return this.getText().width();
        };
        Label.prototype.getHeight = function () {
            return this.getText().height();
        };
        Label.prototype._sync = function () {
            var text = this.getText(), tag = this.getTag(), width, height, pointerDirection, pointerWidth, x, y, pointerHeight;
            if (text && tag) {
                width = text.width();
                height = text.height();
                pointerDirection = tag.pointerDirection();
                pointerWidth = tag.pointerWidth();
                pointerHeight = tag.pointerHeight();
                x = 0;
                y = 0;
                switch (pointerDirection) {
                    case UP:
                        x = width / 2;
                        y = -1 * pointerHeight;
                        break;
                    case RIGHT:
                        x = width + pointerWidth;
                        y = height / 2;
                        break;
                    case DOWN:
                        x = width / 2;
                        y = height + pointerHeight;
                        break;
                    case LEFT:
                        x = -1 * pointerWidth;
                        y = height / 2;
                        break;
                }
                tag.setAttrs({
                    x: -1 * x,
                    y: -1 * y,
                    width: width,
                    height: height
                });
                text.setAttrs({
                    x: -1 * x,
                    y: -1 * y
                });
            }
        };
        return Label;
    }(Group_1.Group));
    exports.Label = Label;
    Label.prototype.className = 'Label';
    Global._registerNode(Label);
    Util.Collection.mapMethods(Label);
    var Tag = (function (_super) {
        __extends(Tag, _super);
        function Tag() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Tag.prototype._sceneFunc = function (context) {
            var width = this.width(), height = this.height(), pointerDirection = this.pointerDirection(), pointerWidth = this.pointerWidth(), pointerHeight = this.pointerHeight(), cornerRadius = this.cornerRadius();
            var topLeft = 0;
            var topRight = 0;
            var bottomLeft = 0;
            var bottomRight = 0;
            if (typeof cornerRadius === 'number') {
                topLeft = topRight = bottomLeft = bottomRight = Math.min(cornerRadius, width / 2, height / 2);
            }
            else {
                topLeft = Math.min(cornerRadius[0] || 0, width / 2, height / 2);
                topRight = Math.min(cornerRadius[1] || 0, width / 2, height / 2);
                bottomRight = Math.min(cornerRadius[2] || 0, width / 2, height / 2);
                bottomLeft = Math.min(cornerRadius[3] || 0, width / 2, height / 2);
            }
            context.beginPath();
            context.moveTo(topLeft, 0);
            if (pointerDirection === UP) {
                context.lineTo((width - pointerWidth) / 2, 0);
                context.lineTo(width / 2, -1 * pointerHeight);
                context.lineTo((width + pointerWidth) / 2, 0);
            }
            context.lineTo(width - topRight, 0);
            context.arc(width - topRight, topRight, topRight, (Math.PI * 3) / 2, 0, false);
            if (pointerDirection === RIGHT) {
                context.lineTo(width, (height - pointerHeight) / 2);
                context.lineTo(width + pointerWidth, height / 2);
                context.lineTo(width, (height + pointerHeight) / 2);
            }
            context.lineTo(width, height - bottomRight);
            context.arc(width - bottomRight, height - bottomRight, bottomRight, 0, Math.PI / 2, false);
            if (pointerDirection === DOWN) {
                context.lineTo((width + pointerWidth) / 2, height);
                context.lineTo(width / 2, height + pointerHeight);
                context.lineTo((width - pointerWidth) / 2, height);
            }
            context.lineTo(bottomLeft, height);
            context.arc(bottomLeft, height - bottomLeft, bottomLeft, Math.PI / 2, Math.PI, false);
            if (pointerDirection === LEFT) {
                context.lineTo(0, (height + pointerHeight) / 2);
                context.lineTo(-1 * pointerWidth, height / 2);
                context.lineTo(0, (height - pointerHeight) / 2);
            }
            context.lineTo(0, topLeft);
            context.arc(topLeft, topLeft, topLeft, Math.PI, (Math.PI * 3) / 2, false);
            context.closePath();
            context.fillStrokeShape(this);
        };
        Tag.prototype.getSelfRect = function () {
            var x = 0, y = 0, pointerWidth = this.pointerWidth(), pointerHeight = this.pointerHeight(), direction = this.pointerDirection(), width = this.width(), height = this.height();
            if (direction === UP) {
                y -= pointerHeight;
                height += pointerHeight;
            }
            else if (direction === DOWN) {
                height += pointerHeight;
            }
            else if (direction === LEFT) {
                x -= pointerWidth * 1.5;
                width += pointerWidth;
            }
            else if (direction === RIGHT) {
                width += pointerWidth * 1.5;
            }
            return {
                x: x,
                y: y,
                width: width,
                height: height
            };
        };
        return Tag;
    }(Shape_1.Shape));
    exports.Tag = Tag;
    Tag.prototype.className = 'Tag';
    Global._registerNode(Tag);
    Factory.Factory.addGetterSetter(Tag, 'pointerDirection', NONE);
    Factory.Factory.addGetterSetter(Tag, 'pointerWidth', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Tag, 'pointerHeight', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Tag, 'cornerRadius', 0, Validators.getNumberOrArrayOfNumbersValidator(4));
    Util.Collection.mapMethods(Tag);
    });

    var Path_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });




    var Path = (function (_super) {
        __extends(Path, _super);
        function Path(config) {
            var _this = _super.call(this, config) || this;
            _this.dataArray = [];
            _this.pathLength = 0;
            _this.dataArray = Path.parsePathData(_this.data());
            _this.pathLength = 0;
            for (var i = 0; i < _this.dataArray.length; ++i) {
                _this.pathLength += _this.dataArray[i].pathLength;
            }
            _this.on('dataChange.konva', function () {
                this.dataArray = Path.parsePathData(this.data());
                this.pathLength = 0;
                for (var i = 0; i < this.dataArray.length; ++i) {
                    this.pathLength += this.dataArray[i].pathLength;
                }
            });
            return _this;
        }
        Path.prototype._sceneFunc = function (context) {
            var ca = this.dataArray;
            context.beginPath();
            var isClosed = false;
            for (var n = 0; n < ca.length; n++) {
                var c = ca[n].command;
                var p = ca[n].points;
                switch (c) {
                    case 'L':
                        context.lineTo(p[0], p[1]);
                        break;
                    case 'M':
                        context.moveTo(p[0], p[1]);
                        break;
                    case 'C':
                        context.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
                        break;
                    case 'Q':
                        context.quadraticCurveTo(p[0], p[1], p[2], p[3]);
                        break;
                    case 'A':
                        var cx = p[0], cy = p[1], rx = p[2], ry = p[3], theta = p[4], dTheta = p[5], psi = p[6], fs = p[7];
                        var r = rx > ry ? rx : ry;
                        var scaleX = rx > ry ? 1 : rx / ry;
                        var scaleY = rx > ry ? ry / rx : 1;
                        context.translate(cx, cy);
                        context.rotate(psi);
                        context.scale(scaleX, scaleY);
                        context.arc(0, 0, r, theta, theta + dTheta, 1 - fs);
                        context.scale(1 / scaleX, 1 / scaleY);
                        context.rotate(-psi);
                        context.translate(-cx, -cy);
                        break;
                    case 'z':
                        isClosed = true;
                        context.closePath();
                        break;
                }
            }
            if (!isClosed && !this.hasFill()) {
                context.strokeShape(this);
            }
            else {
                context.fillStrokeShape(this);
            }
        };
        Path.prototype.getSelfRect = function () {
            var points = [];
            this.dataArray.forEach(function (data) {
                if (data.command === 'A') {
                    var start = data.points[4];
                    var dTheta = data.points[5];
                    var end = data.points[4] + dTheta;
                    var inc = Math.PI / 180.0;
                    if (Math.abs(start - end) < inc) {
                        inc = Math.abs(start - end);
                    }
                    if (dTheta < 0) {
                        for (var t = start - inc; t > end; t -= inc) {
                            var point = Path.getPointOnEllipticalArc(data.points[0], data.points[1], data.points[2], data.points[3], t, 0);
                            points.push(point.x, point.y);
                        }
                    }
                    else {
                        for (var t = start + inc; t < end; t += inc) {
                            var point = Path.getPointOnEllipticalArc(data.points[0], data.points[1], data.points[2], data.points[3], t, 0);
                            points.push(point.x, point.y);
                        }
                    }
                }
                else if (data.command === 'C') {
                    for (var t = 0.0; t <= 1; t += 0.01) {
                        var point = Path.getPointOnCubicBezier(t, data.start.x, data.start.y, data.points[0], data.points[1], data.points[2], data.points[3], data.points[4], data.points[5]);
                        points.push(point.x, point.y);
                    }
                }
                else {
                    points = points.concat(data.points);
                }
            });
            var minX = points[0];
            var maxX = points[0];
            var minY = points[1];
            var maxY = points[1];
            var x, y;
            for (var i = 0; i < points.length / 2; i++) {
                x = points[i * 2];
                y = points[i * 2 + 1];
                if (!isNaN(x)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                }
                if (!isNaN(y)) {
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
            return {
                x: Math.round(minX),
                y: Math.round(minY),
                width: Math.round(maxX - minX),
                height: Math.round(maxY - minY)
            };
        };
        Path.prototype.getLength = function () {
            return this.pathLength;
        };
        Path.prototype.getPointAtLength = function (length) {
            var point, i = 0, ii = this.dataArray.length;
            if (!ii) {
                return null;
            }
            while (i < ii && length > this.dataArray[i].pathLength) {
                length -= this.dataArray[i].pathLength;
                ++i;
            }
            if (i === ii) {
                point = this.dataArray[i - 1].points.slice(-2);
                return {
                    x: point[0],
                    y: point[1]
                };
            }
            if (length < 0.01) {
                point = this.dataArray[i].points.slice(0, 2);
                return {
                    x: point[0],
                    y: point[1]
                };
            }
            var cp = this.dataArray[i];
            var p = cp.points;
            switch (cp.command) {
                case 'L':
                    return Path.getPointOnLine(length, cp.start.x, cp.start.y, p[0], p[1]);
                case 'C':
                    return Path.getPointOnCubicBezier(length / cp.pathLength, cp.start.x, cp.start.y, p[0], p[1], p[2], p[3], p[4], p[5]);
                case 'Q':
                    return Path.getPointOnQuadraticBezier(length / cp.pathLength, cp.start.x, cp.start.y, p[0], p[1], p[2], p[3]);
                case 'A':
                    var cx = p[0], cy = p[1], rx = p[2], ry = p[3], theta = p[4], dTheta = p[5], psi = p[6];
                    theta += (dTheta * length) / cp.pathLength;
                    return Path.getPointOnEllipticalArc(cx, cy, rx, ry, theta, psi);
            }
            return null;
        };
        Path.getLineLength = function (x1, y1, x2, y2) {
            return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        };
        Path.getPointOnLine = function (dist, P1x, P1y, P2x, P2y, fromX, fromY) {
            if (fromX === undefined) {
                fromX = P1x;
            }
            if (fromY === undefined) {
                fromY = P1y;
            }
            var m = (P2y - P1y) / (P2x - P1x + 0.00000001);
            var run = Math.sqrt((dist * dist) / (1 + m * m));
            if (P2x < P1x) {
                run *= -1;
            }
            var rise = m * run;
            var pt;
            if (P2x === P1x) {
                pt = {
                    x: fromX,
                    y: fromY + rise
                };
            }
            else if ((fromY - P1y) / (fromX - P1x + 0.00000001) === m) {
                pt = {
                    x: fromX + run,
                    y: fromY + rise
                };
            }
            else {
                var ix, iy;
                var len = this.getLineLength(P1x, P1y, P2x, P2y);
                if (len < 0.00000001) {
                    return undefined;
                }
                var u = (fromX - P1x) * (P2x - P1x) + (fromY - P1y) * (P2y - P1y);
                u = u / (len * len);
                ix = P1x + u * (P2x - P1x);
                iy = P1y + u * (P2y - P1y);
                var pRise = this.getLineLength(fromX, fromY, ix, iy);
                var pRun = Math.sqrt(dist * dist - pRise * pRise);
                run = Math.sqrt((pRun * pRun) / (1 + m * m));
                if (P2x < P1x) {
                    run *= -1;
                }
                rise = m * run;
                pt = {
                    x: ix + run,
                    y: iy + rise
                };
            }
            return pt;
        };
        Path.getPointOnCubicBezier = function (pct, P1x, P1y, P2x, P2y, P3x, P3y, P4x, P4y) {
            function CB1(t) {
                return t * t * t;
            }
            function CB2(t) {
                return 3 * t * t * (1 - t);
            }
            function CB3(t) {
                return 3 * t * (1 - t) * (1 - t);
            }
            function CB4(t) {
                return (1 - t) * (1 - t) * (1 - t);
            }
            var x = P4x * CB1(pct) + P3x * CB2(pct) + P2x * CB3(pct) + P1x * CB4(pct);
            var y = P4y * CB1(pct) + P3y * CB2(pct) + P2y * CB3(pct) + P1y * CB4(pct);
            return {
                x: x,
                y: y
            };
        };
        Path.getPointOnQuadraticBezier = function (pct, P1x, P1y, P2x, P2y, P3x, P3y) {
            function QB1(t) {
                return t * t;
            }
            function QB2(t) {
                return 2 * t * (1 - t);
            }
            function QB3(t) {
                return (1 - t) * (1 - t);
            }
            var x = P3x * QB1(pct) + P2x * QB2(pct) + P1x * QB3(pct);
            var y = P3y * QB1(pct) + P2y * QB2(pct) + P1y * QB3(pct);
            return {
                x: x,
                y: y
            };
        };
        Path.getPointOnEllipticalArc = function (cx, cy, rx, ry, theta, psi) {
            var cosPsi = Math.cos(psi), sinPsi = Math.sin(psi);
            var pt = {
                x: rx * Math.cos(theta),
                y: ry * Math.sin(theta)
            };
            return {
                x: cx + (pt.x * cosPsi - pt.y * sinPsi),
                y: cy + (pt.x * sinPsi + pt.y * cosPsi)
            };
        };
        Path.parsePathData = function (data) {
            if (!data) {
                return [];
            }
            var cs = data;
            var cc = [
                'm',
                'M',
                'l',
                'L',
                'v',
                'V',
                'h',
                'H',
                'z',
                'Z',
                'c',
                'C',
                'q',
                'Q',
                't',
                'T',
                's',
                'S',
                'a',
                'A'
            ];
            cs = cs.replace(new RegExp(' ', 'g'), ',');
            for (var n = 0; n < cc.length; n++) {
                cs = cs.replace(new RegExp(cc[n], 'g'), '|' + cc[n]);
            }
            var arr = cs.split('|');
            var ca = [];
            var coords = [];
            var cpx = 0;
            var cpy = 0;
            var re = /([-+]?((\d+\.\d+)|((\d+)|(\.\d+)))(?:e[-+]?\d+)?)/gi;
            var match;
            for (n = 1; n < arr.length; n++) {
                var str = arr[n];
                var c = str.charAt(0);
                str = str.slice(1);
                coords.length = 0;
                while ((match = re.exec(str))) {
                    coords.push(match[0]);
                }
                var p = [];
                for (var j = 0, jlen = coords.length; j < jlen; j++) {
                    var parsed = parseFloat(coords[j]);
                    if (!isNaN(parsed)) {
                        p.push(parsed);
                    }
                    else {
                        p.push(0);
                    }
                }
                while (p.length > 0) {
                    if (isNaN(p[0])) {
                        break;
                    }
                    var cmd = null;
                    var points = [];
                    var startX = cpx, startY = cpy;
                    var prevCmd, ctlPtx, ctlPty;
                    var rx, ry, psi, fa, fs, x1, y1;
                    switch (c) {
                        case 'l':
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'L':
                            cpx = p.shift();
                            cpy = p.shift();
                            points.push(cpx, cpy);
                            break;
                        case 'm':
                            var dx = p.shift();
                            var dy = p.shift();
                            cpx += dx;
                            cpy += dy;
                            cmd = 'M';
                            if (ca.length > 2 && ca[ca.length - 1].command === 'z') {
                                for (var idx = ca.length - 2; idx >= 0; idx--) {
                                    if (ca[idx].command === 'M') {
                                        cpx = ca[idx].points[0] + dx;
                                        cpy = ca[idx].points[1] + dy;
                                        break;
                                    }
                                }
                            }
                            points.push(cpx, cpy);
                            c = 'l';
                            break;
                        case 'M':
                            cpx = p.shift();
                            cpy = p.shift();
                            cmd = 'M';
                            points.push(cpx, cpy);
                            c = 'L';
                            break;
                        case 'h':
                            cpx += p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'H':
                            cpx = p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'v':
                            cpy += p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'V':
                            cpy = p.shift();
                            cmd = 'L';
                            points.push(cpx, cpy);
                            break;
                        case 'C':
                            points.push(p.shift(), p.shift(), p.shift(), p.shift());
                            cpx = p.shift();
                            cpy = p.shift();
                            points.push(cpx, cpy);
                            break;
                        case 'c':
                            points.push(cpx + p.shift(), cpy + p.shift(), cpx + p.shift(), cpy + p.shift());
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'C';
                            points.push(cpx, cpy);
                            break;
                        case 'S':
                            ctlPtx = cpx;
                            ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'C') {
                                ctlPtx = cpx + (cpx - prevCmd.points[2]);
                                ctlPty = cpy + (cpy - prevCmd.points[3]);
                            }
                            points.push(ctlPtx, ctlPty, p.shift(), p.shift());
                            cpx = p.shift();
                            cpy = p.shift();
                            cmd = 'C';
                            points.push(cpx, cpy);
                            break;
                        case 's':
                            ctlPtx = cpx;
                            ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'C') {
                                ctlPtx = cpx + (cpx - prevCmd.points[2]);
                                ctlPty = cpy + (cpy - prevCmd.points[3]);
                            }
                            points.push(ctlPtx, ctlPty, cpx + p.shift(), cpy + p.shift());
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'C';
                            points.push(cpx, cpy);
                            break;
                        case 'Q':
                            points.push(p.shift(), p.shift());
                            cpx = p.shift();
                            cpy = p.shift();
                            points.push(cpx, cpy);
                            break;
                        case 'q':
                            points.push(cpx + p.shift(), cpy + p.shift());
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'Q';
                            points.push(cpx, cpy);
                            break;
                        case 'T':
                            ctlPtx = cpx;
                            ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'Q') {
                                ctlPtx = cpx + (cpx - prevCmd.points[0]);
                                ctlPty = cpy + (cpy - prevCmd.points[1]);
                            }
                            cpx = p.shift();
                            cpy = p.shift();
                            cmd = 'Q';
                            points.push(ctlPtx, ctlPty, cpx, cpy);
                            break;
                        case 't':
                            ctlPtx = cpx;
                            ctlPty = cpy;
                            prevCmd = ca[ca.length - 1];
                            if (prevCmd.command === 'Q') {
                                ctlPtx = cpx + (cpx - prevCmd.points[0]);
                                ctlPty = cpy + (cpy - prevCmd.points[1]);
                            }
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'Q';
                            points.push(ctlPtx, ctlPty, cpx, cpy);
                            break;
                        case 'A':
                            rx = p.shift();
                            ry = p.shift();
                            psi = p.shift();
                            fa = p.shift();
                            fs = p.shift();
                            x1 = cpx;
                            y1 = cpy;
                            cpx = p.shift();
                            cpy = p.shift();
                            cmd = 'A';
                            points = this.convertEndpointToCenterParameterization(x1, y1, cpx, cpy, fa, fs, rx, ry, psi);
                            break;
                        case 'a':
                            rx = p.shift();
                            ry = p.shift();
                            psi = p.shift();
                            fa = p.shift();
                            fs = p.shift();
                            x1 = cpx;
                            y1 = cpy;
                            cpx += p.shift();
                            cpy += p.shift();
                            cmd = 'A';
                            points = this.convertEndpointToCenterParameterization(x1, y1, cpx, cpy, fa, fs, rx, ry, psi);
                            break;
                    }
                    ca.push({
                        command: cmd || c,
                        points: points,
                        start: {
                            x: startX,
                            y: startY
                        },
                        pathLength: this.calcLength(startX, startY, cmd || c, points)
                    });
                }
                if (c === 'z' || c === 'Z') {
                    ca.push({
                        command: 'z',
                        points: [],
                        start: undefined,
                        pathLength: 0
                    });
                }
            }
            return ca;
        };
        Path.calcLength = function (x, y, cmd, points) {
            var len, p1, p2, t;
            var path = Path;
            switch (cmd) {
                case 'L':
                    return path.getLineLength(x, y, points[0], points[1]);
                case 'C':
                    len = 0.0;
                    p1 = path.getPointOnCubicBezier(0, x, y, points[0], points[1], points[2], points[3], points[4], points[5]);
                    for (t = 0.01; t <= 1; t += 0.01) {
                        p2 = path.getPointOnCubicBezier(t, x, y, points[0], points[1], points[2], points[3], points[4], points[5]);
                        len += path.getLineLength(p1.x, p1.y, p2.x, p2.y);
                        p1 = p2;
                    }
                    return len;
                case 'Q':
                    len = 0.0;
                    p1 = path.getPointOnQuadraticBezier(0, x, y, points[0], points[1], points[2], points[3]);
                    for (t = 0.01; t <= 1; t += 0.01) {
                        p2 = path.getPointOnQuadraticBezier(t, x, y, points[0], points[1], points[2], points[3]);
                        len += path.getLineLength(p1.x, p1.y, p2.x, p2.y);
                        p1 = p2;
                    }
                    return len;
                case 'A':
                    len = 0.0;
                    var start = points[4];
                    var dTheta = points[5];
                    var end = points[4] + dTheta;
                    var inc = Math.PI / 180.0;
                    if (Math.abs(start - end) < inc) {
                        inc = Math.abs(start - end);
                    }
                    p1 = path.getPointOnEllipticalArc(points[0], points[1], points[2], points[3], start, 0);
                    if (dTheta < 0) {
                        for (t = start - inc; t > end; t -= inc) {
                            p2 = path.getPointOnEllipticalArc(points[0], points[1], points[2], points[3], t, 0);
                            len += path.getLineLength(p1.x, p1.y, p2.x, p2.y);
                            p1 = p2;
                        }
                    }
                    else {
                        for (t = start + inc; t < end; t += inc) {
                            p2 = path.getPointOnEllipticalArc(points[0], points[1], points[2], points[3], t, 0);
                            len += path.getLineLength(p1.x, p1.y, p2.x, p2.y);
                            p1 = p2;
                        }
                    }
                    p2 = path.getPointOnEllipticalArc(points[0], points[1], points[2], points[3], end, 0);
                    len += path.getLineLength(p1.x, p1.y, p2.x, p2.y);
                    return len;
            }
            return 0;
        };
        Path.convertEndpointToCenterParameterization = function (x1, y1, x2, y2, fa, fs, rx, ry, psiDeg) {
            var psi = psiDeg * (Math.PI / 180.0);
            var xp = (Math.cos(psi) * (x1 - x2)) / 2.0 + (Math.sin(psi) * (y1 - y2)) / 2.0;
            var yp = (-1 * Math.sin(psi) * (x1 - x2)) / 2.0 +
                (Math.cos(psi) * (y1 - y2)) / 2.0;
            var lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
            if (lambda > 1) {
                rx *= Math.sqrt(lambda);
                ry *= Math.sqrt(lambda);
            }
            var f = Math.sqrt((rx * rx * (ry * ry) - rx * rx * (yp * yp) - ry * ry * (xp * xp)) /
                (rx * rx * (yp * yp) + ry * ry * (xp * xp)));
            if (fa === fs) {
                f *= -1;
            }
            if (isNaN(f)) {
                f = 0;
            }
            var cxp = (f * rx * yp) / ry;
            var cyp = (f * -ry * xp) / rx;
            var cx = (x1 + x2) / 2.0 + Math.cos(psi) * cxp - Math.sin(psi) * cyp;
            var cy = (y1 + y2) / 2.0 + Math.sin(psi) * cxp + Math.cos(psi) * cyp;
            var vMag = function (v) {
                return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
            };
            var vRatio = function (u, v) {
                return (u[0] * v[0] + u[1] * v[1]) / (vMag(u) * vMag(v));
            };
            var vAngle = function (u, v) {
                return (u[0] * v[1] < u[1] * v[0] ? -1 : 1) * Math.acos(vRatio(u, v));
            };
            var theta = vAngle([1, 0], [(xp - cxp) / rx, (yp - cyp) / ry]);
            var u = [(xp - cxp) / rx, (yp - cyp) / ry];
            var v = [(-1 * xp - cxp) / rx, (-1 * yp - cyp) / ry];
            var dTheta = vAngle(u, v);
            if (vRatio(u, v) <= -1) {
                dTheta = Math.PI;
            }
            if (vRatio(u, v) >= 1) {
                dTheta = 0;
            }
            if (fs === 0 && dTheta > 0) {
                dTheta = dTheta - 2 * Math.PI;
            }
            if (fs === 1 && dTheta < 0) {
                dTheta = dTheta + 2 * Math.PI;
            }
            return [cx, cy, rx, ry, theta, dTheta, psi, fs];
        };
        return Path;
    }(Shape_1.Shape));
    exports.Path = Path;
    Path.prototype.className = 'Path';
    Path.prototype._attrsAffectingSize = ['data'];
    Global._registerNode(Path);
    Factory.Factory.addGetterSetter(Path, 'data');
    Util.Collection.mapMethods(Path);
    });

    var Rect_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Rect = (function (_super) {
        __extends(Rect, _super);
        function Rect() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Rect.prototype._sceneFunc = function (context) {
            var cornerRadius = this.cornerRadius(), width = this.width(), height = this.height();
            context.beginPath();
            if (!cornerRadius) {
                context.rect(0, 0, width, height);
            }
            else {
                var topLeft = 0;
                var topRight = 0;
                var bottomLeft = 0;
                var bottomRight = 0;
                if (typeof cornerRadius === 'number') {
                    topLeft = topRight = bottomLeft = bottomRight = Math.min(cornerRadius, width / 2, height / 2);
                }
                else {
                    topLeft = Math.min(cornerRadius[0] || 0, width / 2, height / 2);
                    topRight = Math.min(cornerRadius[1] || 0, width / 2, height / 2);
                    bottomRight = Math.min(cornerRadius[2] || 0, width / 2, height / 2);
                    bottomLeft = Math.min(cornerRadius[3] || 0, width / 2, height / 2);
                }
                context.moveTo(topLeft, 0);
                context.lineTo(width - topRight, 0);
                context.arc(width - topRight, topRight, topRight, (Math.PI * 3) / 2, 0, false);
                context.lineTo(width, height - bottomRight);
                context.arc(width - bottomRight, height - bottomRight, bottomRight, 0, Math.PI / 2, false);
                context.lineTo(bottomLeft, height);
                context.arc(bottomLeft, height - bottomLeft, bottomLeft, Math.PI / 2, Math.PI, false);
                context.lineTo(0, topLeft);
                context.arc(topLeft, topLeft, topLeft, Math.PI, (Math.PI * 3) / 2, false);
            }
            context.closePath();
            context.fillStrokeShape(this);
        };
        return Rect;
    }(Shape_1.Shape));
    exports.Rect = Rect;
    Rect.prototype.className = 'Rect';
    Global._registerNode(Rect);
    Factory.Factory.addGetterSetter(Rect, 'cornerRadius', 0, Validators.getNumberOrArrayOfNumbersValidator(4));
    Util.Collection.mapMethods(Rect);
    });

    var RegularPolygon_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var RegularPolygon = (function (_super) {
        __extends(RegularPolygon, _super);
        function RegularPolygon() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        RegularPolygon.prototype._sceneFunc = function (context) {
            var sides = this.sides(), radius = this.radius(), n, x, y;
            context.beginPath();
            context.moveTo(0, 0 - radius);
            for (n = 1; n < sides; n++) {
                x = radius * Math.sin((n * 2 * Math.PI) / sides);
                y = -1 * radius * Math.cos((n * 2 * Math.PI) / sides);
                context.lineTo(x, y);
            }
            context.closePath();
            context.fillStrokeShape(this);
        };
        RegularPolygon.prototype.getWidth = function () {
            return this.radius() * 2;
        };
        RegularPolygon.prototype.getHeight = function () {
            return this.radius() * 2;
        };
        RegularPolygon.prototype.setWidth = function (width) {
            this.radius(width / 2);
        };
        RegularPolygon.prototype.setHeight = function (height) {
            this.radius(height / 2);
        };
        return RegularPolygon;
    }(Shape_1.Shape));
    exports.RegularPolygon = RegularPolygon;
    RegularPolygon.prototype.className = 'RegularPolygon';
    RegularPolygon.prototype._centroid = true;
    RegularPolygon.prototype._attrsAffectingSize = ['radius'];
    Global._registerNode(RegularPolygon);
    Factory.Factory.addGetterSetter(RegularPolygon, 'radius', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(RegularPolygon, 'sides', 0, Validators.getNumberValidator());
    Util.Collection.mapMethods(RegularPolygon);
    });

    var Ring_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var PIx2 = Math.PI * 2;
    var Ring = (function (_super) {
        __extends(Ring, _super);
        function Ring() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Ring.prototype._sceneFunc = function (context) {
            context.beginPath();
            context.arc(0, 0, this.innerRadius(), 0, PIx2, false);
            context.moveTo(this.outerRadius(), 0);
            context.arc(0, 0, this.outerRadius(), PIx2, 0, true);
            context.closePath();
            context.fillStrokeShape(this);
        };
        Ring.prototype.getWidth = function () {
            return this.outerRadius() * 2;
        };
        Ring.prototype.getHeight = function () {
            return this.outerRadius() * 2;
        };
        Ring.prototype.setWidth = function (width) {
            this.outerRadius(width / 2);
        };
        Ring.prototype.setHeight = function (height) {
            this.outerRadius(height / 2);
        };
        return Ring;
    }(Shape_1.Shape));
    exports.Ring = Ring;
    Ring.prototype.className = 'Ring';
    Ring.prototype._centroid = true;
    Ring.prototype._attrsAffectingSize = ['innerRadius', 'outerRadius'];
    Global._registerNode(Ring);
    Factory.Factory.addGetterSetter(Ring, 'innerRadius', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Ring, 'outerRadius', 0, Validators.getNumberValidator());
    Util.Collection.mapMethods(Ring);
    });

    var Sprite_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });






    var Sprite = (function (_super) {
        __extends(Sprite, _super);
        function Sprite(config) {
            var _this = _super.call(this, config) || this;
            _this._updated = true;
            _this.anim = new Animation_1.Animation(function () {
                var updated = _this._updated;
                _this._updated = false;
                return updated;
            });
            _this.on('animationChange.konva', function () {
                this.frameIndex(0);
            });
            _this.on('frameIndexChange.konva', function () {
                this._updated = true;
            });
            _this.on('frameRateChange.konva', function () {
                if (!this.anim.isRunning()) {
                    return;
                }
                clearInterval(this.interval);
                this._setInterval();
            });
            return _this;
        }
        Sprite.prototype._sceneFunc = function (context) {
            var anim = this.animation(), index = this.frameIndex(), ix4 = index * 4, set = this.animations()[anim], offsets = this.frameOffsets(), x = set[ix4 + 0], y = set[ix4 + 1], width = set[ix4 + 2], height = set[ix4 + 3], image = this.image();
            if (this.hasFill() || this.hasStroke()) {
                context.beginPath();
                context.rect(0, 0, width, height);
                context.closePath();
                context.fillStrokeShape(this);
            }
            if (image) {
                if (offsets) {
                    var offset = offsets[anim], ix2 = index * 2;
                    context.drawImage(image, x, y, width, height, offset[ix2 + 0], offset[ix2 + 1], width, height);
                }
                else {
                    context.drawImage(image, x, y, width, height, 0, 0, width, height);
                }
            }
        };
        Sprite.prototype._hitFunc = function (context) {
            var anim = this.animation(), index = this.frameIndex(), ix4 = index * 4, set = this.animations()[anim], offsets = this.frameOffsets(), width = set[ix4 + 2], height = set[ix4 + 3];
            context.beginPath();
            if (offsets) {
                var offset = offsets[anim];
                var ix2 = index * 2;
                context.rect(offset[ix2 + 0], offset[ix2 + 1], width, height);
            }
            else {
                context.rect(0, 0, width, height);
            }
            context.closePath();
            context.fillShape(this);
        };
        Sprite.prototype._useBufferCanvas = function () {
            return _super.prototype._useBufferCanvas.call(this, true);
        };
        Sprite.prototype._setInterval = function () {
            var that = this;
            this.interval = setInterval(function () {
                that._updateIndex();
            }, 1000 / this.frameRate());
        };
        Sprite.prototype.start = function () {
            if (this.isRunning()) {
                return;
            }
            var layer = this.getLayer();
            this.anim.setLayers(layer);
            this._setInterval();
            this.anim.start();
        };
        Sprite.prototype.stop = function () {
            this.anim.stop();
            clearInterval(this.interval);
        };
        Sprite.prototype.isRunning = function () {
            return this.anim.isRunning();
        };
        Sprite.prototype._updateIndex = function () {
            var index = this.frameIndex(), animation = this.animation(), animations = this.animations(), anim = animations[animation], len = anim.length / 4;
            if (index < len - 1) {
                this.frameIndex(index + 1);
            }
            else {
                this.frameIndex(0);
            }
        };
        return Sprite;
    }(Shape_1.Shape));
    exports.Sprite = Sprite;
    Sprite.prototype.className = 'Sprite';
    Global._registerNode(Sprite);
    Factory.Factory.addGetterSetter(Sprite, 'animation');
    Factory.Factory.addGetterSetter(Sprite, 'animations');
    Factory.Factory.addGetterSetter(Sprite, 'frameOffsets');
    Factory.Factory.addGetterSetter(Sprite, 'image');
    Factory.Factory.addGetterSetter(Sprite, 'frameIndex', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Sprite, 'frameRate', 17, Validators.getNumberValidator());
    Factory.Factory.backCompat(Sprite, {
        index: 'frameIndex',
        getIndex: 'getFrameIndex',
        setIndex: 'setFrameIndex',
    });
    Util.Collection.mapMethods(Sprite);
    });

    var Star_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Star = (function (_super) {
        __extends(Star, _super);
        function Star() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Star.prototype._sceneFunc = function (context) {
            var innerRadius = this.innerRadius(), outerRadius = this.outerRadius(), numPoints = this.numPoints();
            context.beginPath();
            context.moveTo(0, 0 - outerRadius);
            for (var n = 1; n < numPoints * 2; n++) {
                var radius = n % 2 === 0 ? outerRadius : innerRadius;
                var x = radius * Math.sin((n * Math.PI) / numPoints);
                var y = -1 * radius * Math.cos((n * Math.PI) / numPoints);
                context.lineTo(x, y);
            }
            context.closePath();
            context.fillStrokeShape(this);
        };
        Star.prototype.getWidth = function () {
            return this.outerRadius() * 2;
        };
        Star.prototype.getHeight = function () {
            return this.outerRadius() * 2;
        };
        Star.prototype.setWidth = function (width) {
            this.outerRadius(width / 2);
        };
        Star.prototype.setHeight = function (height) {
            this.outerRadius(height / 2);
        };
        return Star;
    }(Shape_1.Shape));
    exports.Star = Star;
    Star.prototype.className = 'Star';
    Star.prototype._centroid = true;
    Star.prototype._attrsAffectingSize = ['innerRadius', 'outerRadius'];
    Global._registerNode(Star);
    Factory.Factory.addGetterSetter(Star, 'numPoints', 5, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Star, 'innerRadius', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Star, 'outerRadius', 0, Validators.getNumberValidator());
    Util.Collection.mapMethods(Star);
    });

    var Text_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Global_2 = Global;
    function stringToArray(string) {
        return Array.from(string);
    }
    exports.stringToArray = stringToArray;
    var AUTO = 'auto', CENTER = 'center', JUSTIFY = 'justify', CHANGE_KONVA = 'Change.konva', CONTEXT_2D = '2d', DASH = '-', LEFT = 'left', TEXT = 'text', TEXT_UPPER = 'Text', TOP = 'top', BOTTOM = 'bottom', MIDDLE = 'middle', NORMAL = 'normal', PX_SPACE = 'px ', SPACE = ' ', RIGHT = 'right', WORD = 'word', CHAR = 'char', NONE = 'none', ELLIPSIS = '…', ATTR_CHANGE_LIST = [
        'fontFamily',
        'fontSize',
        'fontStyle',
        'fontVariant',
        'padding',
        'align',
        'verticalAlign',
        'lineHeight',
        'text',
        'width',
        'height',
        'wrap',
        'ellipsis',
        'letterSpacing',
    ], attrChangeListLen = ATTR_CHANGE_LIST.length;
    function normalizeFontFamily(fontFamily) {
        return fontFamily
            .split(',')
            .map(function (family) {
            family = family.trim();
            var hasSpace = family.indexOf(' ') >= 0;
            var hasQuotes = family.indexOf('"') >= 0 || family.indexOf("'") >= 0;
            if (hasSpace && !hasQuotes) {
                family = "\"" + family + "\"";
            }
            return family;
        })
            .join(', ');
    }
    var dummyContext;
    function getDummyContext() {
        if (dummyContext) {
            return dummyContext;
        }
        dummyContext = Util.Util.createCanvasElement().getContext(CONTEXT_2D);
        return dummyContext;
    }
    function _fillFunc(context) {
        context.fillText(this._partialText, this._partialTextX, this._partialTextY);
    }
    function _strokeFunc(context) {
        context.strokeText(this._partialText, this._partialTextX, this._partialTextY);
    }
    function checkDefaultFill(config) {
        config = config || {};
        if (!config.fillLinearGradientColorStops &&
            !config.fillRadialGradientColorStops &&
            !config.fillPatternImage) {
            config.fill = config.fill || 'black';
        }
        return config;
    }
    var Text = (function (_super) {
        __extends(Text, _super);
        function Text(config) {
            var _this = _super.call(this, checkDefaultFill(config)) || this;
            _this._partialTextX = 0;
            _this._partialTextY = 0;
            for (var n = 0; n < attrChangeListLen; n++) {
                _this.on(ATTR_CHANGE_LIST[n] + CHANGE_KONVA, _this._setTextData);
            }
            _this._setTextData();
            return _this;
        }
        Text.prototype._sceneFunc = function (context) {
            var padding = this.padding(), fontSize = this.fontSize(), lineHeightPx = this.lineHeight() * fontSize, textArr = this.textArr, textArrLen = textArr.length, verticalAlign = this.verticalAlign(), alignY = 0, align = this.align(), totalWidth = this.getWidth(), letterSpacing = this.letterSpacing(), fill = this.fill(), textDecoration = this.textDecoration(), shouldUnderline = textDecoration.indexOf('underline') !== -1, shouldLineThrough = textDecoration.indexOf('line-through') !== -1, n;
            var translateY = 0;
            var translateY = lineHeightPx / 2;
            var lineTranslateX = 0;
            var lineTranslateY = 0;
            context.setAttr('font', this._getContextFont());
            context.setAttr('textBaseline', MIDDLE);
            context.setAttr('textAlign', LEFT);
            if (verticalAlign === MIDDLE) {
                alignY = (this.getHeight() - textArrLen * lineHeightPx - padding * 2) / 2;
            }
            else if (verticalAlign === BOTTOM) {
                alignY = this.getHeight() - textArrLen * lineHeightPx - padding * 2;
            }
            context.translate(padding, alignY + padding);
            for (n = 0; n < textArrLen; n++) {
                var lineTranslateX = 0;
                var lineTranslateY = 0;
                var obj = textArr[n], text = obj.text, width = obj.width, lastLine = n !== textArrLen - 1, spacesNumber, oneWord, lineWidth;
                context.save();
                if (align === RIGHT) {
                    lineTranslateX += totalWidth - width - padding * 2;
                }
                else if (align === CENTER) {
                    lineTranslateX += (totalWidth - width - padding * 2) / 2;
                }
                if (shouldUnderline) {
                    context.save();
                    context.beginPath();
                    context.moveTo(lineTranslateX, translateY + lineTranslateY + Math.round(fontSize / 2));
                    spacesNumber = text.split(' ').length - 1;
                    oneWord = spacesNumber === 0;
                    lineWidth =
                        align === JUSTIFY && lastLine && !oneWord
                            ? totalWidth - padding * 2
                            : width;
                    context.lineTo(lineTranslateX + Math.round(lineWidth), translateY + lineTranslateY + Math.round(fontSize / 2));
                    context.lineWidth = fontSize / 15;
                    context.strokeStyle = fill;
                    context.stroke();
                    context.restore();
                }
                if (shouldLineThrough) {
                    context.save();
                    context.beginPath();
                    context.moveTo(lineTranslateX, translateY + lineTranslateY);
                    spacesNumber = text.split(' ').length - 1;
                    oneWord = spacesNumber === 0;
                    lineWidth =
                        align === JUSTIFY && lastLine && !oneWord
                            ? totalWidth - padding * 2
                            : width;
                    context.lineTo(lineTranslateX + Math.round(lineWidth), translateY + lineTranslateY);
                    context.lineWidth = fontSize / 15;
                    context.strokeStyle = fill;
                    context.stroke();
                    context.restore();
                }
                if (letterSpacing !== 0 || align === JUSTIFY) {
                    spacesNumber = text.split(' ').length - 1;
                    var array = stringToArray(text);
                    for (var li = 0; li < array.length; li++) {
                        var letter = array[li];
                        if (letter === ' ' && n !== textArrLen - 1 && align === JUSTIFY) {
                            lineTranslateX += (totalWidth - padding * 2 - width) / spacesNumber;
                        }
                        this._partialTextX = lineTranslateX;
                        this._partialTextY = translateY + lineTranslateY;
                        this._partialText = letter;
                        context.fillStrokeShape(this);
                        lineTranslateX += this.measureSize(letter).width + letterSpacing;
                    }
                }
                else {
                    this._partialTextX = lineTranslateX;
                    this._partialTextY = translateY + lineTranslateY;
                    this._partialText = text;
                    context.fillStrokeShape(this);
                }
                context.restore();
                if (textArrLen > 1) {
                    translateY += lineHeightPx;
                }
            }
        };
        Text.prototype._hitFunc = function (context) {
            var width = this.getWidth(), height = this.getHeight();
            context.beginPath();
            context.rect(0, 0, width, height);
            context.closePath();
            context.fillStrokeShape(this);
        };
        Text.prototype.setText = function (text) {
            var str = Util.Util._isString(text)
                ? text
                : text === null || text === undefined
                    ? ''
                    : text + '';
            this._setAttr(TEXT, str);
            return this;
        };
        Text.prototype.getWidth = function () {
            var isAuto = this.attrs.width === AUTO || this.attrs.width === undefined;
            return isAuto ? this.getTextWidth() + this.padding() * 2 : this.attrs.width;
        };
        Text.prototype.getHeight = function () {
            var isAuto = this.attrs.height === AUTO || this.attrs.height === undefined;
            return isAuto
                ? this.fontSize() * this.textArr.length * this.lineHeight() +
                    this.padding() * 2
                : this.attrs.height;
        };
        Text.prototype.getTextWidth = function () {
            return this.textWidth;
        };
        Text.prototype.getTextHeight = function () {
            Util.Util.warn('text.getTextHeight() method is deprecated. Use text.height() - for full height and text.fontSize() - for one line height.');
            return this.textHeight;
        };
        Text.prototype.measureSize = function (text) {
            var _context = getDummyContext(), fontSize = this.fontSize(), metrics;
            _context.save();
            _context.font = this._getContextFont();
            metrics = _context.measureText(text);
            _context.restore();
            return {
                width: metrics.width,
                height: fontSize,
            };
        };
        Text.prototype._getContextFont = function () {
            if (Global.Konva.UA.isIE) {
                return (this.fontStyle() +
                    SPACE +
                    this.fontSize() +
                    PX_SPACE +
                    this.fontFamily());
            }
            return (this.fontStyle() +
                SPACE +
                this.fontVariant() +
                SPACE +
                (this.fontSize() + PX_SPACE) +
                normalizeFontFamily(this.fontFamily()));
        };
        Text.prototype._addTextLine = function (line) {
            if (this.align() === JUSTIFY) {
                line = line.trim();
            }
            var width = this._getTextWidth(line);
            return this.textArr.push({ text: line, width: width });
        };
        Text.prototype._getTextWidth = function (text) {
            var letterSpacing = this.letterSpacing();
            var length = text.length;
            return (getDummyContext().measureText(text).width +
                (length ? letterSpacing * (length - 1) : 0));
        };
        Text.prototype._setTextData = function () {
            var lines = this.text().split('\n'), fontSize = +this.fontSize(), textWidth = 0, lineHeightPx = this.lineHeight() * fontSize, width = this.attrs.width, height = this.attrs.height, fixedWidth = width !== AUTO && width !== undefined, fixedHeight = height !== AUTO && height !== undefined, padding = this.padding(), maxWidth = width - padding * 2, maxHeightPx = height - padding * 2, currentHeightPx = 0, wrap = this.wrap(), shouldWrap = wrap !== NONE, wrapAtWord = wrap !== CHAR && shouldWrap, shouldAddEllipsis = this.ellipsis();
            this.textArr = [];
            getDummyContext().font = this._getContextFont();
            var additionalWidth = shouldAddEllipsis ? this._getTextWidth(ELLIPSIS) : 0;
            for (var i = 0, max = lines.length; i < max; ++i) {
                var line = lines[i];
                var lineWidth = this._getTextWidth(line);
                if (fixedWidth && lineWidth > maxWidth) {
                    while (line.length > 0) {
                        var low = 0, high = line.length, match = '', matchWidth = 0;
                        while (low < high) {
                            var mid = (low + high) >>> 1, substr = line.slice(0, mid + 1), substrWidth = this._getTextWidth(substr) + additionalWidth;
                            if (substrWidth <= maxWidth) {
                                low = mid + 1;
                                match = substr + (shouldAddEllipsis ? ELLIPSIS : '');
                                matchWidth = substrWidth;
                            }
                            else {
                                high = mid;
                            }
                        }
                        if (match) {
                            if (wrapAtWord) {
                                var wrapIndex;
                                var nextChar = line[match.length];
                                var nextIsSpaceOrDash = nextChar === SPACE || nextChar === DASH;
                                if (nextIsSpaceOrDash && matchWidth <= maxWidth) {
                                    wrapIndex = match.length;
                                }
                                else {
                                    wrapIndex =
                                        Math.max(match.lastIndexOf(SPACE), match.lastIndexOf(DASH)) +
                                            1;
                                }
                                if (wrapIndex > 0) {
                                    low = wrapIndex;
                                    match = match.slice(0, low);
                                    matchWidth = this._getTextWidth(match);
                                }
                            }
                            match = match.trimRight();
                            this._addTextLine(match);
                            textWidth = Math.max(textWidth, matchWidth);
                            currentHeightPx += lineHeightPx;
                            if (!shouldWrap ||
                                (fixedHeight && currentHeightPx + lineHeightPx > maxHeightPx)) {
                                var lastLine = this.textArr[this.textArr.length - 1];
                                if (lastLine) {
                                    if (shouldAddEllipsis) {
                                        var haveSpace = this._getTextWidth(lastLine.text + ELLIPSIS) < maxWidth;
                                        if (!haveSpace) {
                                            lastLine.text = lastLine.text.slice(0, lastLine.text.length - 3);
                                        }
                                        this.textArr.splice(this.textArr.length - 1, 1);
                                        this._addTextLine(lastLine.text + ELLIPSIS);
                                    }
                                }
                                break;
                            }
                            line = line.slice(low);
                            line = line.trimLeft();
                            if (line.length > 0) {
                                lineWidth = this._getTextWidth(line);
                                if (lineWidth <= maxWidth) {
                                    this._addTextLine(line);
                                    currentHeightPx += lineHeightPx;
                                    textWidth = Math.max(textWidth, lineWidth);
                                    break;
                                }
                            }
                        }
                        else {
                            break;
                        }
                    }
                }
                else {
                    this._addTextLine(line);
                    currentHeightPx += lineHeightPx;
                    textWidth = Math.max(textWidth, lineWidth);
                }
                if (fixedHeight && currentHeightPx + lineHeightPx > maxHeightPx) {
                    break;
                }
            }
            this.textHeight = fontSize;
            this.textWidth = textWidth;
        };
        Text.prototype.getStrokeScaleEnabled = function () {
            return true;
        };
        return Text;
    }(Shape_1.Shape));
    exports.Text = Text;
    Text.prototype._fillFunc = _fillFunc;
    Text.prototype._strokeFunc = _strokeFunc;
    Text.prototype.className = TEXT_UPPER;
    Text.prototype._attrsAffectingSize = [
        'text',
        'fontSize',
        'padding',
        'wrap',
        'lineHeight',
    ];
    Global_2._registerNode(Text);
    Factory.Factory.overWriteSetter(Text, 'width', Validators.getNumberOrAutoValidator());
    Factory.Factory.overWriteSetter(Text, 'height', Validators.getNumberOrAutoValidator());
    Factory.Factory.addGetterSetter(Text, 'fontFamily', 'Arial');
    Factory.Factory.addGetterSetter(Text, 'fontSize', 12, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Text, 'fontStyle', NORMAL);
    Factory.Factory.addGetterSetter(Text, 'fontVariant', NORMAL);
    Factory.Factory.addGetterSetter(Text, 'padding', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Text, 'align', LEFT);
    Factory.Factory.addGetterSetter(Text, 'verticalAlign', TOP);
    Factory.Factory.addGetterSetter(Text, 'lineHeight', 1, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Text, 'wrap', WORD);
    Factory.Factory.addGetterSetter(Text, 'ellipsis', false, Validators.getBooleanValidator());
    Factory.Factory.addGetterSetter(Text, 'letterSpacing', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Text, 'text', '', Validators.getStringValidator());
    Factory.Factory.addGetterSetter(Text, 'textDecoration', '');
    Util.Collection.mapMethods(Text);
    });

    var TextPath_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });







    var EMPTY_STRING = '', NORMAL = 'normal';
    function _fillFunc(context) {
        context.fillText(this.partialText, 0, 0);
    }
    function _strokeFunc(context) {
        context.strokeText(this.partialText, 0, 0);
    }
    var TextPath = (function (_super) {
        __extends(TextPath, _super);
        function TextPath(config) {
            var _this = _super.call(this, config) || this;
            _this.dummyCanvas = Util.Util.createCanvasElement();
            _this.dataArray = [];
            _this.dataArray = Path_1.Path.parsePathData(_this.attrs.data);
            _this.on('dataChange.konva', function () {
                this.dataArray = Path_1.Path.parsePathData(this.attrs.data);
                this._setTextData();
            });
            _this.on('textChange.konva alignChange.konva letterSpacingChange.konva kerningFuncChange.konva', _this._setTextData);
            if (config && config['getKerning']) {
                Util.Util.warn('getKerning TextPath API is deprecated. Please use "kerningFunc" instead.');
                _this.kerningFunc(config['getKerning']);
            }
            _this._setTextData();
            return _this;
        }
        TextPath.prototype._sceneFunc = function (context) {
            context.setAttr('font', this._getContextFont());
            context.setAttr('textBaseline', this.textBaseline());
            context.setAttr('textAlign', 'left');
            context.save();
            var textDecoration = this.textDecoration();
            var fill = this.fill();
            var fontSize = this.fontSize();
            var glyphInfo = this.glyphInfo;
            if (textDecoration === 'underline') {
                context.beginPath();
            }
            for (var i = 0; i < glyphInfo.length; i++) {
                context.save();
                var p0 = glyphInfo[i].p0;
                context.translate(p0.x, p0.y);
                context.rotate(glyphInfo[i].rotation);
                this.partialText = glyphInfo[i].text;
                context.fillStrokeShape(this);
                if (textDecoration === 'underline') {
                    if (i === 0) {
                        context.moveTo(0, fontSize / 2 + 1);
                    }
                    context.lineTo(fontSize, fontSize / 2 + 1);
                }
                context.restore();
            }
            if (textDecoration === 'underline') {
                context.strokeStyle = fill;
                context.lineWidth = fontSize / 20;
                context.stroke();
            }
            context.restore();
        };
        TextPath.prototype._hitFunc = function (context) {
            context.beginPath();
            var glyphInfo = this.glyphInfo;
            if (glyphInfo.length >= 1) {
                var p0 = glyphInfo[0].p0;
                context.moveTo(p0.x, p0.y);
            }
            for (var i = 0; i < glyphInfo.length; i++) {
                var p1 = glyphInfo[i].p1;
                context.lineTo(p1.x, p1.y);
            }
            context.setAttr('lineWidth', this.fontSize());
            context.setAttr('strokeStyle', this.colorKey);
            context.stroke();
        };
        TextPath.prototype.getTextWidth = function () {
            return this.textWidth;
        };
        TextPath.prototype.getTextHeight = function () {
            Util.Util.warn('text.getTextHeight() method is deprecated. Use text.height() - for full height and text.fontSize() - for one line height.');
            return this.textHeight;
        };
        TextPath.prototype.setText = function (text) {
            return Text_1.Text.prototype.setText.call(this, text);
        };
        TextPath.prototype._getContextFont = function () {
            return Text_1.Text.prototype._getContextFont.call(this);
        };
        TextPath.prototype._getTextSize = function (text) {
            var dummyCanvas = this.dummyCanvas;
            var _context = dummyCanvas.getContext('2d');
            _context.save();
            _context.font = this._getContextFont();
            var metrics = _context.measureText(text);
            _context.restore();
            return {
                width: metrics.width,
                height: parseInt(this.attrs.fontSize, 10),
            };
        };
        TextPath.prototype._setTextData = function () {
            var that = this;
            var size = this._getTextSize(this.attrs.text);
            var letterSpacing = this.letterSpacing();
            var align = this.align();
            var kerningFunc = this.kerningFunc();
            this.textWidth = size.width;
            this.textHeight = size.height;
            var textFullWidth = Math.max(this.textWidth + ((this.attrs.text || '').length - 1) * letterSpacing, 0);
            this.glyphInfo = [];
            var fullPathWidth = 0;
            for (var l = 0; l < that.dataArray.length; l++) {
                if (that.dataArray[l].pathLength > 0) {
                    fullPathWidth += that.dataArray[l].pathLength;
                }
            }
            var offset = 0;
            if (align === 'center') {
                offset = Math.max(0, fullPathWidth / 2 - textFullWidth / 2);
            }
            if (align === 'right') {
                offset = Math.max(0, fullPathWidth - textFullWidth);
            }
            var charArr = Text_1.stringToArray(this.text());
            var spacesNumber = this.text().split(' ').length - 1;
            var p0, p1, pathCmd;
            var pIndex = -1;
            var currentT = 0;
            var getNextPathSegment = function () {
                currentT = 0;
                var pathData = that.dataArray;
                for (var j = pIndex + 1; j < pathData.length; j++) {
                    if (pathData[j].pathLength > 0) {
                        pIndex = j;
                        return pathData[j];
                    }
                    else if (pathData[j].command === 'M') {
                        p0 = {
                            x: pathData[j].points[0],
                            y: pathData[j].points[1],
                        };
                    }
                }
                return {};
            };
            var findSegmentToFitCharacter = function (c) {
                var glyphWidth = that._getTextSize(c).width + letterSpacing;
                if (c === ' ' && align === 'justify') {
                    glyphWidth += (fullPathWidth - textFullWidth) / spacesNumber;
                }
                var currLen = 0;
                var attempts = 0;
                p1 = undefined;
                while (Math.abs(glyphWidth - currLen) / glyphWidth > 0.01 &&
                    attempts < 25) {
                    attempts++;
                    var cumulativePathLength = currLen;
                    while (pathCmd === undefined) {
                        pathCmd = getNextPathSegment();
                        if (pathCmd &&
                            cumulativePathLength + pathCmd.pathLength < glyphWidth) {
                            cumulativePathLength += pathCmd.pathLength;
                            pathCmd = undefined;
                        }
                    }
                    if (pathCmd === {} || p0 === undefined) {
                        return undefined;
                    }
                    var needNewSegment = false;
                    switch (pathCmd.command) {
                        case 'L':
                            if (Path_1.Path.getLineLength(p0.x, p0.y, pathCmd.points[0], pathCmd.points[1]) > glyphWidth) {
                                p1 = Path_1.Path.getPointOnLine(glyphWidth, p0.x, p0.y, pathCmd.points[0], pathCmd.points[1], p0.x, p0.y);
                            }
                            else {
                                pathCmd = undefined;
                            }
                            break;
                        case 'A':
                            var start = pathCmd.points[4];
                            var dTheta = pathCmd.points[5];
                            var end = pathCmd.points[4] + dTheta;
                            if (currentT === 0) {
                                currentT = start + 0.00000001;
                            }
                            else if (glyphWidth > currLen) {
                                currentT += ((Math.PI / 180.0) * dTheta) / Math.abs(dTheta);
                            }
                            else {
                                currentT -= ((Math.PI / 360.0) * dTheta) / Math.abs(dTheta);
                            }
                            if ((dTheta < 0 && currentT < end) ||
                                (dTheta >= 0 && currentT > end)) {
                                currentT = end;
                                needNewSegment = true;
                            }
                            p1 = Path_1.Path.getPointOnEllipticalArc(pathCmd.points[0], pathCmd.points[1], pathCmd.points[2], pathCmd.points[3], currentT, pathCmd.points[6]);
                            break;
                        case 'C':
                            if (currentT === 0) {
                                if (glyphWidth > pathCmd.pathLength) {
                                    currentT = 0.00000001;
                                }
                                else {
                                    currentT = glyphWidth / pathCmd.pathLength;
                                }
                            }
                            else if (glyphWidth > currLen) {
                                currentT += (glyphWidth - currLen) / pathCmd.pathLength;
                            }
                            else {
                                currentT -= (currLen - glyphWidth) / pathCmd.pathLength;
                            }
                            if (currentT > 1.0) {
                                currentT = 1.0;
                                needNewSegment = true;
                            }
                            p1 = Path_1.Path.getPointOnCubicBezier(currentT, pathCmd.start.x, pathCmd.start.y, pathCmd.points[0], pathCmd.points[1], pathCmd.points[2], pathCmd.points[3], pathCmd.points[4], pathCmd.points[5]);
                            break;
                        case 'Q':
                            if (currentT === 0) {
                                currentT = glyphWidth / pathCmd.pathLength;
                            }
                            else if (glyphWidth > currLen) {
                                currentT += (glyphWidth - currLen) / pathCmd.pathLength;
                            }
                            else {
                                currentT -= (currLen - glyphWidth) / pathCmd.pathLength;
                            }
                            if (currentT > 1.0) {
                                currentT = 1.0;
                                needNewSegment = true;
                            }
                            p1 = Path_1.Path.getPointOnQuadraticBezier(currentT, pathCmd.start.x, pathCmd.start.y, pathCmd.points[0], pathCmd.points[1], pathCmd.points[2], pathCmd.points[3]);
                            break;
                    }
                    if (p1 !== undefined) {
                        currLen = Path_1.Path.getLineLength(p0.x, p0.y, p1.x, p1.y);
                    }
                    if (needNewSegment) {
                        needNewSegment = false;
                        pathCmd = undefined;
                    }
                }
            };
            var testChar = 'C';
            var glyphWidth = that._getTextSize(testChar).width + letterSpacing;
            var lettersInOffset = offset / glyphWidth - 1;
            for (var k = 0; k < lettersInOffset; k++) {
                findSegmentToFitCharacter(testChar);
                if (p0 === undefined || p1 === undefined) {
                    break;
                }
                p0 = p1;
            }
            for (var i = 0; i < charArr.length; i++) {
                findSegmentToFitCharacter(charArr[i]);
                if (p0 === undefined || p1 === undefined) {
                    break;
                }
                var width = Path_1.Path.getLineLength(p0.x, p0.y, p1.x, p1.y);
                var kern = 0;
                if (kerningFunc) {
                    try {
                        kern = kerningFunc(charArr[i - 1], charArr[i]) * this.fontSize();
                    }
                    catch (e) {
                        kern = 0;
                    }
                }
                p0.x += kern;
                p1.x += kern;
                this.textWidth += kern;
                var midpoint = Path_1.Path.getPointOnLine(kern + width / 2.0, p0.x, p0.y, p1.x, p1.y);
                var rotation = Math.atan2(p1.y - p0.y, p1.x - p0.x);
                this.glyphInfo.push({
                    transposeX: midpoint.x,
                    transposeY: midpoint.y,
                    text: charArr[i],
                    rotation: rotation,
                    p0: p0,
                    p1: p1,
                });
                p0 = p1;
            }
        };
        TextPath.prototype.getSelfRect = function () {
            if (!this.glyphInfo.length) {
                return {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                };
            }
            var points = [];
            this.glyphInfo.forEach(function (info) {
                points.push(info.p0.x);
                points.push(info.p0.y);
                points.push(info.p1.x);
                points.push(info.p1.y);
            });
            var minX = points[0] || 0;
            var maxX = points[0] || 0;
            var minY = points[1] || 0;
            var maxY = points[1] || 0;
            var x, y;
            for (var i = 0; i < points.length / 2; i++) {
                x = points[i * 2];
                y = points[i * 2 + 1];
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
            var fontSize = this.fontSize();
            return {
                x: minX - fontSize / 2,
                y: minY - fontSize / 2,
                width: maxX - minX + fontSize,
                height: maxY - minY + fontSize,
            };
        };
        return TextPath;
    }(Shape_1.Shape));
    exports.TextPath = TextPath;
    TextPath.prototype._fillFunc = _fillFunc;
    TextPath.prototype._strokeFunc = _strokeFunc;
    TextPath.prototype._fillFuncHit = _fillFunc;
    TextPath.prototype._strokeFuncHit = _strokeFunc;
    TextPath.prototype.className = 'TextPath';
    TextPath.prototype._attrsAffectingSize = ['text', 'fontSize', 'data'];
    Global._registerNode(TextPath);
    Factory.Factory.addGetterSetter(TextPath, 'data');
    Factory.Factory.addGetterSetter(TextPath, 'fontFamily', 'Arial');
    Factory.Factory.addGetterSetter(TextPath, 'fontSize', 12, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(TextPath, 'fontStyle', NORMAL);
    Factory.Factory.addGetterSetter(TextPath, 'align', 'left');
    Factory.Factory.addGetterSetter(TextPath, 'letterSpacing', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(TextPath, 'textBaseline', 'middle');
    Factory.Factory.addGetterSetter(TextPath, 'fontVariant', NORMAL);
    Factory.Factory.addGetterSetter(TextPath, 'text', EMPTY_STRING);
    Factory.Factory.addGetterSetter(TextPath, 'textDecoration', null);
    Factory.Factory.addGetterSetter(TextPath, 'kerningFunc', null);
    Util.Collection.mapMethods(TextPath);
    });

    var Transformer_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __assign = (commonjsGlobal && commonjsGlobal.__assign) || function () {
        __assign = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    Object.defineProperty(exports, "__esModule", { value: true });








    var Global_2 = Global;
    var EVENTS_NAME = 'tr-konva';
    var ATTR_CHANGE_LIST = [
        'resizeEnabledChange',
        'rotateAnchorOffsetChange',
        'rotateEnabledChange',
        'enabledAnchorsChange',
        'anchorSizeChange',
        'borderEnabledChange',
        'borderStrokeChange',
        'borderStrokeWidthChange',
        'borderDashChange',
        'anchorStrokeChange',
        'anchorStrokeWidthChange',
        'anchorFillChange',
        'anchorCornerRadiusChange',
        'ignoreStrokeChange',
    ]
        .map(function (e) { return e + ("." + EVENTS_NAME); })
        .join(' ');
    var NODES_RECT = 'nodesRect';
    var TRANSFORM_CHANGE_STR = [
        'widthChange',
        'heightChange',
        'scaleXChange',
        'scaleYChange',
        'skewXChange',
        'skewYChange',
        'rotationChange',
        'offsetXChange',
        'offsetYChange',
        'transformsEnabledChange',
        'strokeWidthChange',
    ]
        .map(function (e) { return e + ("." + EVENTS_NAME); })
        .join(' ');
    var ANGLES = {
        'top-left': -45,
        'top-center': 0,
        'top-right': 45,
        'middle-right': -90,
        'middle-left': 90,
        'bottom-left': -135,
        'bottom-center': 180,
        'bottom-right': 135,
    };
    var TOUCH_DEVICE = 'ontouchstart' in Global.Konva._global;
    function getCursor(anchorName, rad) {
        if (anchorName === 'rotater') {
            return 'crosshair';
        }
        rad += Util.Util._degToRad(ANGLES[anchorName] || 0);
        var angle = ((Util.Util._radToDeg(rad) % 360) + 360) % 360;
        if (Util.Util._inRange(angle, 315 + 22.5, 360) || Util.Util._inRange(angle, 0, 22.5)) {
            return 'ns-resize';
        }
        else if (Util.Util._inRange(angle, 45 - 22.5, 45 + 22.5)) {
            return 'nesw-resize';
        }
        else if (Util.Util._inRange(angle, 90 - 22.5, 90 + 22.5)) {
            return 'ew-resize';
        }
        else if (Util.Util._inRange(angle, 135 - 22.5, 135 + 22.5)) {
            return 'nwse-resize';
        }
        else if (Util.Util._inRange(angle, 180 - 22.5, 180 + 22.5)) {
            return 'ns-resize';
        }
        else if (Util.Util._inRange(angle, 225 - 22.5, 225 + 22.5)) {
            return 'nesw-resize';
        }
        else if (Util.Util._inRange(angle, 270 - 22.5, 270 + 22.5)) {
            return 'ew-resize';
        }
        else if (Util.Util._inRange(angle, 315 - 22.5, 315 + 22.5)) {
            return 'nwse-resize';
        }
        else {
            Util.Util.error('Transformer has unknown angle for cursor detection: ' + angle);
            return 'pointer';
        }
    }
    var ANCHORS_NAMES = [
        'top-left',
        'top-center',
        'top-right',
        'middle-right',
        'middle-left',
        'bottom-left',
        'bottom-center',
        'bottom-right',
    ];
    var MAX_SAFE_INTEGER = 100000000;
    function getCenter(shape) {
        return {
            x: shape.x +
                (shape.width / 2) * Math.cos(shape.rotation) +
                (shape.height / 2) * Math.sin(-shape.rotation),
            y: shape.y +
                (shape.height / 2) * Math.cos(shape.rotation) +
                (shape.width / 2) * Math.sin(shape.rotation),
        };
    }
    function rotateAroundPoint(shape, angleRad, point) {
        var x = point.x +
            (shape.x - point.x) * Math.cos(angleRad) -
            (shape.y - point.y) * Math.sin(angleRad);
        var y = point.y +
            (shape.x - point.x) * Math.sin(angleRad) +
            (shape.y - point.y) * Math.cos(angleRad);
        return __assign(__assign({}, shape), { rotation: shape.rotation + angleRad, x: x,
            y: y });
    }
    function rotateAroundCenter(shape, deltaRad) {
        var center = getCenter(shape);
        return rotateAroundPoint(shape, deltaRad, center);
    }
    function getSnap(snaps, newRotationRad, tol) {
        var snapped = newRotationRad;
        for (var i = 0; i < snaps.length; i++) {
            var angle = Global.Konva.getAngle(snaps[i]);
            var absDiff = Math.abs(angle - newRotationRad) % (Math.PI * 2);
            var dif = Math.min(absDiff, Math.PI * 2 - absDiff);
            if (dif < tol) {
                snapped = angle;
            }
        }
        return snapped;
    }
    var Transformer = (function (_super) {
        __extends(Transformer, _super);
        function Transformer(config) {
            var _this = _super.call(this, config) || this;
            _this._transforming = false;
            _this._createElements();
            _this._handleMouseMove = _this._handleMouseMove.bind(_this);
            _this._handleMouseUp = _this._handleMouseUp.bind(_this);
            _this.update = _this.update.bind(_this);
            _this.on(ATTR_CHANGE_LIST, _this.update);
            if (_this.getNode()) {
                _this.update();
            }
            return _this;
        }
        Transformer.prototype.attachTo = function (node) {
            this.setNode(node);
            return this;
        };
        Transformer.prototype.setNode = function (node) {
            Util.Util.warn('tr.setNode(shape), tr.node(shape) and tr.attachTo(shape) methods are deprecated. Please use tr.nodes(nodesArray) instead.');
            return this.setNodes([node]);
        };
        Transformer.prototype.getNode = function () {
            return this._nodes && this._nodes[0];
        };
        Transformer.prototype.setNodes = function (nodes) {
            var _this = this;
            if (nodes === void 0) { nodes = []; }
            if (this._nodes && this._nodes.length) {
                this.detach();
            }
            this._nodes = nodes;
            if (nodes.length === 1) {
                this.rotation(nodes[0].rotation());
            }
            else {
                this.rotation(0);
            }
            this._nodes.forEach(function (node) {
                var additionalEvents = node._attrsAffectingSize
                    .map(function (prop) { return prop + 'Change.' + EVENTS_NAME; })
                    .join(' ');
                var onChange = function () {
                    if (_this.nodes().length === 1) {
                        _this.rotation(_this.nodes()[0].rotation());
                    }
                    _this._resetTransformCache();
                    if (!_this._transforming) {
                        _this.update();
                    }
                };
                node.on(additionalEvents, onChange);
                node.on(TRANSFORM_CHANGE_STR, onChange);
                node.on("_clearTransformCache." + EVENTS_NAME, onChange);
                node.on("xChange." + EVENTS_NAME + " yChange." + EVENTS_NAME, onChange);
                _this._proxyDrag(node);
            });
            this._resetTransformCache();
            var elementsCreated = !!this.findOne('.top-left');
            if (elementsCreated) {
                this.update();
            }
            return this;
        };
        Transformer.prototype._proxyDrag = function (node) {
            var _this = this;
            var lastPos;
            node.on("dragstart." + EVENTS_NAME, function (e) {
                lastPos = node.getAbsolutePosition();
                if (!_this.isDragging() && node !== _this.findOne('.back')) {
                    _this.startDrag(e, false);
                }
            });
            node.on("dragmove." + EVENTS_NAME, function (e) {
                if (!lastPos) {
                    return;
                }
                var abs = node.getAbsolutePosition();
                var dx = abs.x - lastPos.x;
                var dy = abs.y - lastPos.y;
                _this.nodes().forEach(function (otherNode) {
                    if (otherNode === node) {
                        return;
                    }
                    if (otherNode.isDragging()) {
                        return;
                    }
                    var otherAbs = otherNode.getAbsolutePosition();
                    otherNode.setAbsolutePosition({
                        x: otherAbs.x + dx,
                        y: otherAbs.y + dy,
                    });
                    otherNode.startDrag(e);
                });
                lastPos = null;
            });
        };
        Transformer.prototype.getNodes = function () {
            return this._nodes || [];
        };
        Transformer.prototype.getActiveAnchor = function () {
            return this._movingAnchorName;
        };
        Transformer.prototype.detach = function () {
            if (this._nodes) {
                this._nodes.forEach(function (node) {
                    node.off('.' + EVENTS_NAME);
                });
            }
            this._nodes = [];
            this._resetTransformCache();
        };
        Transformer.prototype._resetTransformCache = function () {
            this._clearCache(NODES_RECT);
            this._clearCache('transform');
            this._clearSelfAndDescendantCache('absoluteTransform');
        };
        Transformer.prototype._getNodeRect = function () {
            return this._getCache(NODES_RECT, this.__getNodeRect);
        };
        Transformer.prototype.__getNodeShape = function (node, rot, relative) {
            if (rot === void 0) { rot = this.rotation(); }
            var rect = node.getClientRect({
                skipTransform: true,
                skipShadow: true,
                skipStroke: this.ignoreStroke(),
            });
            var absScale = node.getAbsoluteScale(relative);
            var absPos = node.getAbsolutePosition(relative);
            var dx = rect.x * absScale.x - node.offsetX() * absScale.x;
            var dy = rect.y * absScale.y - node.offsetY() * absScale.y;
            var rotation = (Global.Konva.getAngle(node.getAbsoluteRotation()) + Math.PI * 2) %
                (Math.PI * 2);
            var box = {
                x: absPos.x + dx * Math.cos(rotation) + dy * Math.sin(-rotation),
                y: absPos.y + dy * Math.cos(rotation) + dx * Math.sin(rotation),
                width: rect.width * absScale.x,
                height: rect.height * absScale.y,
                rotation: rotation,
            };
            return rotateAroundPoint(box, -Global.Konva.getAngle(rot), {
                x: 0,
                y: 0,
            });
        };
        Transformer.prototype.__getNodeRect = function () {
            var _this = this;
            var node = this.getNode();
            if (!node) {
                return {
                    x: -MAX_SAFE_INTEGER,
                    y: -MAX_SAFE_INTEGER,
                    width: 0,
                    height: 0,
                    rotation: 0,
                };
            }
            var totalPoints = [];
            this.nodes().map(function (node) {
                var box = node.getClientRect({
                    skipTransform: true,
                    skipShadow: true,
                    skipStroke: _this.ignoreStroke(),
                });
                var points = [
                    { x: box.x, y: box.y },
                    { x: box.x + box.width, y: box.y },
                    { x: box.x + box.width, y: box.y + box.height },
                    { x: box.x, y: box.y + box.height },
                ];
                var trans = node.getAbsoluteTransform();
                points.forEach(function (point) {
                    var transformed = trans.point(point);
                    totalPoints.push(transformed);
                });
            });
            var tr = new Util.Transform();
            tr.rotate(-Global.Konva.getAngle(this.rotation()));
            var minX, minY, maxX, maxY;
            totalPoints.forEach(function (point) {
                var transformed = tr.point(point);
                if (minX === undefined) {
                    minX = maxX = transformed.x;
                    minY = maxY = transformed.y;
                }
                minX = Math.min(minX, transformed.x);
                minY = Math.min(minY, transformed.y);
                maxX = Math.max(maxX, transformed.x);
                maxY = Math.max(maxY, transformed.y);
            });
            tr.invert();
            var p = tr.point({ x: minX, y: minY });
            return {
                x: p.x,
                y: p.y,
                width: maxX - minX,
                height: maxY - minY,
                rotation: Global.Konva.getAngle(this.rotation()),
            };
        };
        Transformer.prototype.getX = function () {
            return this._getNodeRect().x;
        };
        Transformer.prototype.getY = function () {
            return this._getNodeRect().y;
        };
        Transformer.prototype.getWidth = function () {
            return this._getNodeRect().width;
        };
        Transformer.prototype.getHeight = function () {
            return this._getNodeRect().height;
        };
        Transformer.prototype._createElements = function () {
            this._createBack();
            ANCHORS_NAMES.forEach(function (name) {
                this._createAnchor(name);
            }.bind(this));
            this._createAnchor('rotater');
        };
        Transformer.prototype._createAnchor = function (name) {
            var _this = this;
            var anchor = new Rect_1.Rect({
                stroke: 'rgb(0, 161, 255)',
                fill: 'white',
                strokeWidth: 1,
                name: name + ' _anchor',
                dragDistance: 0,
                draggable: true,
                hitStrokeWidth: TOUCH_DEVICE ? 10 : 'auto',
            });
            var self = this;
            anchor.on('mousedown touchstart', function (e) {
                self._handleMouseDown(e);
            });
            anchor.on('dragstart', function (e) {
                anchor.stopDrag();
                e.cancelBubble = true;
            });
            anchor.on('dragend', function (e) {
                e.cancelBubble = true;
            });
            anchor.on('mouseenter', function () {
                var rad = Global.Konva.getAngle(_this.rotation());
                var cursor = getCursor(name, rad);
                anchor.getStage().content.style.cursor = cursor;
                _this._cursorChange = true;
            });
            anchor.on('mouseout', function () {
                anchor.getStage().content.style.cursor = '';
                _this._cursorChange = false;
            });
            this.add(anchor);
        };
        Transformer.prototype._createBack = function () {
            var _this = this;
            var back = new Shape_1.Shape({
                name: 'back',
                width: 0,
                height: 0,
                draggable: true,
                sceneFunc: function (ctx) {
                    var tr = this.getParent();
                    var padding = tr.padding();
                    ctx.beginPath();
                    ctx.rect(-padding, -padding, this.width() + padding * 2, this.height() + padding * 2);
                    ctx.moveTo(this.width() / 2, -padding);
                    if (tr.rotateEnabled()) {
                        ctx.lineTo(this.width() / 2, -tr.rotateAnchorOffset() * Util.Util._sign(this.height()) - padding);
                    }
                    ctx.fillStrokeShape(this);
                },
                hitFunc: function (ctx, shape) {
                    if (!_this.shouldOverdrawWholeArea()) {
                        return;
                    }
                    var padding = _this.padding();
                    ctx.beginPath();
                    ctx.rect(-padding, -padding, shape.width() + padding * 2, shape.height() + padding * 2);
                    ctx.fillStrokeShape(shape);
                },
            });
            this.add(back);
            this._proxyDrag(back);
        };
        Transformer.prototype._handleMouseDown = function (e) {
            this._movingAnchorName = e.target.name().split(' ')[0];
            var attrs = this._getNodeRect();
            var width = attrs.width;
            var height = attrs.height;
            var hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
            this.sin = Math.abs(height / hypotenuse);
            this.cos = Math.abs(width / hypotenuse);
            window.addEventListener('mousemove', this._handleMouseMove);
            window.addEventListener('touchmove', this._handleMouseMove);
            window.addEventListener('mouseup', this._handleMouseUp, true);
            window.addEventListener('touchend', this._handleMouseUp, true);
            this._transforming = true;
            var ap = e.target.getAbsolutePosition();
            var pos = e.target.getStage().getPointerPosition();
            this._anchorDragOffset = {
                x: pos.x - ap.x,
                y: pos.y - ap.y,
            };
            this._fire('transformstart', { evt: e, target: this.getNode() });
            this.getNode()._fire('transformstart', { evt: e, target: this.getNode() });
        };
        Transformer.prototype._handleMouseMove = function (e) {
            var x, y, newHypotenuse;
            var anchorNode = this.findOne('.' + this._movingAnchorName);
            var stage = anchorNode.getStage();
            stage.setPointersPositions(e);
            var pp = stage.getPointerPosition();
            var newNodePos = {
                x: pp.x - this._anchorDragOffset.x,
                y: pp.y - this._anchorDragOffset.y,
            };
            var oldAbs = anchorNode.getAbsolutePosition();
            anchorNode.setAbsolutePosition(newNodePos);
            var newAbs = anchorNode.getAbsolutePosition();
            if (oldAbs.x === newAbs.x && oldAbs.y === newAbs.y) {
                return;
            }
            if (this._movingAnchorName === 'rotater') {
                var attrs = this._getNodeRect();
                x = anchorNode.x() - attrs.width / 2;
                y = -anchorNode.y() + attrs.height / 2;
                var delta = Math.atan2(-y, x) + Math.PI / 2;
                if (attrs.height < 0) {
                    delta -= Math.PI;
                }
                var oldRotation = Global.Konva.getAngle(this.rotation());
                var newRotation = oldRotation + delta;
                var tol = Global.Konva.getAngle(this.rotationSnapTolerance());
                var snappedRot = getSnap(this.rotationSnaps(), newRotation, tol);
                var diff = snappedRot - attrs.rotation;
                var shape = rotateAroundCenter(attrs, diff);
                this._fitNodesInto(shape, e);
                return;
            }
            var keepProportion = this.keepRatio() || e.shiftKey;
            var centeredScaling = this.centeredScaling() || e.altKey;
            if (this._movingAnchorName === 'top-left') {
                if (keepProportion) {
                    var comparePoint = centeredScaling
                        ? {
                            x: this.width() / 2,
                            y: this.height() / 2,
                        }
                        : {
                            x: this.findOne('.bottom-right').x(),
                            y: this.findOne('.bottom-right').y(),
                        };
                    newHypotenuse = Math.sqrt(Math.pow(comparePoint.x - anchorNode.x(), 2) +
                        Math.pow(comparePoint.y - anchorNode.y(), 2));
                    var reverseX = this.findOne('.top-left').x() > comparePoint.x ? -1 : 1;
                    var reverseY = this.findOne('.top-left').y() > comparePoint.y ? -1 : 1;
                    x = newHypotenuse * this.cos * reverseX;
                    y = newHypotenuse * this.sin * reverseY;
                    this.findOne('.top-left').x(comparePoint.x - x);
                    this.findOne('.top-left').y(comparePoint.y - y);
                }
            }
            else if (this._movingAnchorName === 'top-center') {
                this.findOne('.top-left').y(anchorNode.y());
            }
            else if (this._movingAnchorName === 'top-right') {
                if (keepProportion) {
                    var comparePoint = centeredScaling
                        ? {
                            x: this.width() / 2,
                            y: this.height() / 2,
                        }
                        : {
                            x: this.findOne('.bottom-left').x(),
                            y: this.findOne('.bottom-left').y(),
                        };
                    newHypotenuse = Math.sqrt(Math.pow(anchorNode.x() - comparePoint.x, 2) +
                        Math.pow(comparePoint.y - anchorNode.y(), 2));
                    var reverseX = this.findOne('.top-right').x() < comparePoint.x ? -1 : 1;
                    var reverseY = this.findOne('.top-right').y() > comparePoint.y ? -1 : 1;
                    x = newHypotenuse * this.cos * reverseX;
                    y = newHypotenuse * this.sin * reverseY;
                    this.findOne('.top-right').x(comparePoint.x + x);
                    this.findOne('.top-right').y(comparePoint.y - y);
                }
                var pos = anchorNode.position();
                this.findOne('.top-left').y(pos.y);
                this.findOne('.bottom-right').x(pos.x);
            }
            else if (this._movingAnchorName === 'middle-left') {
                this.findOne('.top-left').x(anchorNode.x());
            }
            else if (this._movingAnchorName === 'middle-right') {
                this.findOne('.bottom-right').x(anchorNode.x());
            }
            else if (this._movingAnchorName === 'bottom-left') {
                if (keepProportion) {
                    var comparePoint = centeredScaling
                        ? {
                            x: this.width() / 2,
                            y: this.height() / 2,
                        }
                        : {
                            x: this.findOne('.top-right').x(),
                            y: this.findOne('.top-right').y(),
                        };
                    newHypotenuse = Math.sqrt(Math.pow(comparePoint.x - anchorNode.x(), 2) +
                        Math.pow(anchorNode.y() - comparePoint.y, 2));
                    var reverseX = comparePoint.x < anchorNode.x() ? -1 : 1;
                    var reverseY = anchorNode.y() < comparePoint.y ? -1 : 1;
                    x = newHypotenuse * this.cos * reverseX;
                    y = newHypotenuse * this.sin * reverseY;
                    anchorNode.x(comparePoint.x - x);
                    anchorNode.y(comparePoint.y + y);
                }
                pos = anchorNode.position();
                this.findOne('.top-left').x(pos.x);
                this.findOne('.bottom-right').y(pos.y);
            }
            else if (this._movingAnchorName === 'bottom-center') {
                this.findOne('.bottom-right').y(anchorNode.y());
            }
            else if (this._movingAnchorName === 'bottom-right') {
                if (keepProportion) {
                    var comparePoint = centeredScaling
                        ? {
                            x: this.width() / 2,
                            y: this.height() / 2,
                        }
                        : {
                            x: this.findOne('.top-left').x(),
                            y: this.findOne('.top-left').y(),
                        };
                    newHypotenuse = Math.sqrt(Math.pow(anchorNode.x() - comparePoint.x, 2) +
                        Math.pow(anchorNode.y() - comparePoint.y, 2));
                    var reverseX = this.findOne('.bottom-right').x() < comparePoint.x ? -1 : 1;
                    var reverseY = this.findOne('.bottom-right').y() < comparePoint.y ? -1 : 1;
                    x = newHypotenuse * this.cos * reverseX;
                    y = newHypotenuse * this.sin * reverseY;
                    this.findOne('.bottom-right').x(comparePoint.x + x);
                    this.findOne('.bottom-right').y(comparePoint.y + y);
                }
            }
            else {
                console.error(new Error('Wrong position argument of selection resizer: ' +
                    this._movingAnchorName));
            }
            var centeredScaling = this.centeredScaling() || e.altKey;
            if (centeredScaling) {
                var topLeft = this.findOne('.top-left');
                var bottomRight = this.findOne('.bottom-right');
                var topOffsetX = topLeft.x();
                var topOffsetY = topLeft.y();
                var bottomOffsetX = this.getWidth() - bottomRight.x();
                var bottomOffsetY = this.getHeight() - bottomRight.y();
                bottomRight.move({
                    x: -topOffsetX,
                    y: -topOffsetY,
                });
                topLeft.move({
                    x: bottomOffsetX,
                    y: bottomOffsetY,
                });
            }
            var absPos = this.findOne('.top-left').getAbsolutePosition();
            x = absPos.x;
            y = absPos.y;
            var width = this.findOne('.bottom-right').x() - this.findOne('.top-left').x();
            var height = this.findOne('.bottom-right').y() - this.findOne('.top-left').y();
            this._fitNodesInto({
                x: x,
                y: y,
                width: width,
                height: height,
                rotation: Global.Konva.getAngle(this.rotation()),
            }, e);
        };
        Transformer.prototype._handleMouseUp = function (e) {
            this._removeEvents(e);
        };
        Transformer.prototype.getAbsoluteTransform = function () {
            return this.getTransform();
        };
        Transformer.prototype._removeEvents = function (e) {
            if (this._transforming) {
                this._transforming = false;
                window.removeEventListener('mousemove', this._handleMouseMove);
                window.removeEventListener('touchmove', this._handleMouseMove);
                window.removeEventListener('mouseup', this._handleMouseUp, true);
                window.removeEventListener('touchend', this._handleMouseUp, true);
                var node = this.getNode();
                this._fire('transformend', { evt: e, target: node });
                if (node) {
                    node.fire('transformend', { evt: e, target: node });
                }
                this._movingAnchorName = null;
            }
        };
        Transformer.prototype._fitNodesInto = function (newAttrs, evt) {
            var _this = this;
            var oldAttrs = this._getNodeRect();
            var minSize = 1;
            if (Util.Util._inRange(newAttrs.width, -this.padding() * 2 - minSize, minSize)) {
                this.update();
                return;
            }
            if (Util.Util._inRange(newAttrs.height, -this.padding() * 2 - minSize, minSize)) {
                this.update();
                return;
            }
            var t = new Util.Transform();
            t.rotate(Global.Konva.getAngle(this.rotation()));
            if (this._movingAnchorName &&
                newAttrs.width < 0 &&
                this._movingAnchorName.indexOf('left') >= 0) {
                var offset = t.point({
                    x: -this.padding() * 2,
                    y: 0,
                });
                newAttrs.x += offset.x;
                newAttrs.y += offset.y;
                newAttrs.width += this.padding() * 2;
                this._movingAnchorName = this._movingAnchorName.replace('left', 'right');
                this._anchorDragOffset.x -= offset.x;
                this._anchorDragOffset.y -= offset.y;
            }
            else if (this._movingAnchorName &&
                newAttrs.width < 0 &&
                this._movingAnchorName.indexOf('right') >= 0) {
                var offset = t.point({
                    x: this.padding() * 2,
                    y: 0,
                });
                this._movingAnchorName = this._movingAnchorName.replace('right', 'left');
                this._anchorDragOffset.x -= offset.x;
                this._anchorDragOffset.y -= offset.y;
                newAttrs.width += this.padding() * 2;
            }
            if (this._movingAnchorName &&
                newAttrs.height < 0 &&
                this._movingAnchorName.indexOf('top') >= 0) {
                var offset = t.point({
                    x: 0,
                    y: -this.padding() * 2,
                });
                newAttrs.x += offset.x;
                newAttrs.y += offset.y;
                this._movingAnchorName = this._movingAnchorName.replace('top', 'bottom');
                this._anchorDragOffset.x -= offset.x;
                this._anchorDragOffset.y -= offset.y;
                newAttrs.height += this.padding() * 2;
            }
            else if (this._movingAnchorName &&
                newAttrs.height < 0 &&
                this._movingAnchorName.indexOf('bottom') >= 0) {
                var offset = t.point({
                    x: 0,
                    y: this.padding() * 2,
                });
                this._movingAnchorName = this._movingAnchorName.replace('bottom', 'top');
                this._anchorDragOffset.x -= offset.x;
                this._anchorDragOffset.y -= offset.y;
                newAttrs.height += this.padding() * 2;
            }
            if (this.boundBoxFunc()) {
                var bounded = this.boundBoxFunc()(oldAttrs, newAttrs);
                if (bounded) {
                    newAttrs = bounded;
                }
                else {
                    Util.Util.warn('boundBoxFunc returned falsy. You should return new bound rect from it!');
                }
            }
            var baseSize = 10000000;
            var oldTr = new Util.Transform();
            oldTr.translate(oldAttrs.x, oldAttrs.y);
            oldTr.rotate(oldAttrs.rotation);
            oldTr.scale(oldAttrs.width / baseSize, oldAttrs.height / baseSize);
            var newTr = new Util.Transform();
            newTr.translate(newAttrs.x, newAttrs.y);
            newTr.rotate(newAttrs.rotation);
            newTr.scale(newAttrs.width / baseSize, newAttrs.height / baseSize);
            var delta = newTr.multiply(oldTr.invert());
            this._nodes.forEach(function (node) {
                var parentTransform = node.getParent().getAbsoluteTransform();
                var localTransform = node.getTransform().copy();
                localTransform.translate(node.offsetX(), node.offsetY());
                var newLocalTransform = new Util.Transform();
                newLocalTransform
                    .multiply(parentTransform.copy().invert())
                    .multiply(delta)
                    .multiply(parentTransform)
                    .multiply(localTransform);
                var attrs = newLocalTransform.decompose();
                node.setAttrs(attrs);
                _this._fire('transform', { evt: evt, target: node });
                node._fire('transform', { evt: evt, target: node });
            });
            this.rotation(Util.Util._getRotation(newAttrs.rotation));
            this._resetTransformCache();
            this.update();
            this.getLayer().batchDraw();
        };
        Transformer.prototype.forceUpdate = function () {
            this._resetTransformCache();
            this.update();
        };
        Transformer.prototype._batchChangeChild = function (selector, attrs) {
            var anchor = this.findOne(selector);
            anchor.setAttrs(attrs);
        };
        Transformer.prototype.update = function () {
            var _this = this;
            var attrs = this._getNodeRect();
            this.rotation(Util.Util._getRotation(attrs.rotation));
            var width = attrs.width;
            var height = attrs.height;
            var enabledAnchors = this.enabledAnchors();
            var resizeEnabled = this.resizeEnabled();
            var padding = this.padding();
            var anchorSize = this.anchorSize();
            this.find('._anchor').each(function (node) {
                node.setAttrs({
                    width: anchorSize,
                    height: anchorSize,
                    offsetX: anchorSize / 2,
                    offsetY: anchorSize / 2,
                    stroke: _this.anchorStroke(),
                    strokeWidth: _this.anchorStrokeWidth(),
                    fill: _this.anchorFill(),
                    cornerRadius: _this.anchorCornerRadius(),
                });
            });
            this._batchChangeChild('.top-left', {
                x: 0,
                y: 0,
                offsetX: anchorSize / 2 + padding,
                offsetY: anchorSize / 2 + padding,
                visible: resizeEnabled && enabledAnchors.indexOf('top-left') >= 0,
            });
            this._batchChangeChild('.top-center', {
                x: width / 2,
                y: 0,
                offsetY: anchorSize / 2 + padding,
                visible: resizeEnabled && enabledAnchors.indexOf('top-center') >= 0,
            });
            this._batchChangeChild('.top-right', {
                x: width,
                y: 0,
                offsetX: anchorSize / 2 - padding,
                offsetY: anchorSize / 2 + padding,
                visible: resizeEnabled && enabledAnchors.indexOf('top-right') >= 0,
            });
            this._batchChangeChild('.middle-left', {
                x: 0,
                y: height / 2,
                offsetX: anchorSize / 2 + padding,
                visible: resizeEnabled && enabledAnchors.indexOf('middle-left') >= 0,
            });
            this._batchChangeChild('.middle-right', {
                x: width,
                y: height / 2,
                offsetX: anchorSize / 2 - padding,
                visible: resizeEnabled && enabledAnchors.indexOf('middle-right') >= 0,
            });
            this._batchChangeChild('.bottom-left', {
                x: 0,
                y: height,
                offsetX: anchorSize / 2 + padding,
                offsetY: anchorSize / 2 - padding,
                visible: resizeEnabled && enabledAnchors.indexOf('bottom-left') >= 0,
            });
            this._batchChangeChild('.bottom-center', {
                x: width / 2,
                y: height,
                offsetY: anchorSize / 2 - padding,
                visible: resizeEnabled && enabledAnchors.indexOf('bottom-center') >= 0,
            });
            this._batchChangeChild('.bottom-right', {
                x: width,
                y: height,
                offsetX: anchorSize / 2 - padding,
                offsetY: anchorSize / 2 - padding,
                visible: resizeEnabled && enabledAnchors.indexOf('bottom-right') >= 0,
            });
            this._batchChangeChild('.rotater', {
                x: width / 2,
                y: -this.rotateAnchorOffset() * Util.Util._sign(height) - padding,
                visible: this.rotateEnabled(),
            });
            this._batchChangeChild('.back', {
                width: width,
                height: height,
                visible: this.borderEnabled(),
                stroke: this.borderStroke(),
                strokeWidth: this.borderStrokeWidth(),
                dash: this.borderDash(),
                x: 0,
                y: 0,
            });
        };
        Transformer.prototype.isTransforming = function () {
            return this._transforming;
        };
        Transformer.prototype.stopTransform = function () {
            if (this._transforming) {
                this._removeEvents();
                var anchorNode = this.findOne('.' + this._movingAnchorName);
                if (anchorNode) {
                    anchorNode.stopDrag();
                }
            }
        };
        Transformer.prototype.destroy = function () {
            if (this.getStage() && this._cursorChange) {
                this.getStage().content.style.cursor = '';
            }
            Group_1.Group.prototype.destroy.call(this);
            this.detach();
            this._removeEvents();
            return this;
        };
        Transformer.prototype.toObject = function () {
            return Node_1.Node.prototype.toObject.call(this);
        };
        return Transformer;
    }(Group_1.Group));
    exports.Transformer = Transformer;
    function validateAnchors(val) {
        if (!(val instanceof Array)) {
            Util.Util.warn('enabledAnchors value should be an array');
        }
        if (val instanceof Array) {
            val.forEach(function (name) {
                if (ANCHORS_NAMES.indexOf(name) === -1) {
                    Util.Util.warn('Unknown anchor name: ' +
                        name +
                        '. Available names are: ' +
                        ANCHORS_NAMES.join(', '));
                }
            });
        }
        return val || [];
    }
    Transformer.prototype.className = 'Transformer';
    Global_2._registerNode(Transformer);
    Factory.Factory.addGetterSetter(Transformer, 'enabledAnchors', ANCHORS_NAMES, validateAnchors);
    Factory.Factory.addGetterSetter(Transformer, 'resizeEnabled', true);
    Factory.Factory.addGetterSetter(Transformer, 'anchorSize', 10, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Transformer, 'rotateEnabled', true);
    Factory.Factory.addGetterSetter(Transformer, 'rotationSnaps', []);
    Factory.Factory.addGetterSetter(Transformer, 'rotateAnchorOffset', 50, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Transformer, 'rotationSnapTolerance', 5, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Transformer, 'borderEnabled', true);
    Factory.Factory.addGetterSetter(Transformer, 'anchorStroke', 'rgb(0, 161, 255)');
    Factory.Factory.addGetterSetter(Transformer, 'anchorStrokeWidth', 1, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Transformer, 'anchorFill', 'white');
    Factory.Factory.addGetterSetter(Transformer, 'anchorCornerRadius', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Transformer, 'borderStroke', 'rgb(0, 161, 255)');
    Factory.Factory.addGetterSetter(Transformer, 'borderStrokeWidth', 1, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Transformer, 'borderDash');
    Factory.Factory.addGetterSetter(Transformer, 'keepRatio', true);
    Factory.Factory.addGetterSetter(Transformer, 'centeredScaling', false);
    Factory.Factory.addGetterSetter(Transformer, 'ignoreStroke', false);
    Factory.Factory.addGetterSetter(Transformer, 'padding', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Transformer, 'node');
    Factory.Factory.addGetterSetter(Transformer, 'nodes');
    Factory.Factory.addGetterSetter(Transformer, 'boundBoxFunc');
    Factory.Factory.addGetterSetter(Transformer, 'shouldOverdrawWholeArea', false);
    Factory.Factory.backCompat(Transformer, {
        lineEnabled: 'borderEnabled',
        rotateHandlerOffset: 'rotateAnchorOffset',
        enabledHandlers: 'enabledAnchors',
    });
    Util.Collection.mapMethods(Transformer);
    });

    var Wedge_1 = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });





    var Global_2 = Global;
    var Wedge = (function (_super) {
        __extends(Wedge, _super);
        function Wedge() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Wedge.prototype._sceneFunc = function (context) {
            context.beginPath();
            context.arc(0, 0, this.radius(), 0, Global.Konva.getAngle(this.angle()), this.clockwise());
            context.lineTo(0, 0);
            context.closePath();
            context.fillStrokeShape(this);
        };
        Wedge.prototype.getWidth = function () {
            return this.radius() * 2;
        };
        Wedge.prototype.getHeight = function () {
            return this.radius() * 2;
        };
        Wedge.prototype.setWidth = function (width) {
            this.radius(width / 2);
        };
        Wedge.prototype.setHeight = function (height) {
            this.radius(height / 2);
        };
        return Wedge;
    }(Shape_1.Shape));
    exports.Wedge = Wedge;
    Wedge.prototype.className = 'Wedge';
    Wedge.prototype._centroid = true;
    Wedge.prototype._attrsAffectingSize = ['radius'];
    Global_2._registerNode(Wedge);
    Factory.Factory.addGetterSetter(Wedge, 'radius', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Wedge, 'angle', 0, Validators.getNumberValidator());
    Factory.Factory.addGetterSetter(Wedge, 'clockwise', false);
    Factory.Factory.backCompat(Wedge, {
        angleDeg: 'angle',
        getAngleDeg: 'getAngle',
        setAngleDeg: 'setAngle'
    });
    Util.Collection.mapMethods(Wedge);
    });

    var Blur = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    function BlurStack() {
        this.r = 0;
        this.g = 0;
        this.b = 0;
        this.a = 0;
        this.next = null;
    }
    var mul_table = [
        512,
        512,
        456,
        512,
        328,
        456,
        335,
        512,
        405,
        328,
        271,
        456,
        388,
        335,
        292,
        512,
        454,
        405,
        364,
        328,
        298,
        271,
        496,
        456,
        420,
        388,
        360,
        335,
        312,
        292,
        273,
        512,
        482,
        454,
        428,
        405,
        383,
        364,
        345,
        328,
        312,
        298,
        284,
        271,
        259,
        496,
        475,
        456,
        437,
        420,
        404,
        388,
        374,
        360,
        347,
        335,
        323,
        312,
        302,
        292,
        282,
        273,
        265,
        512,
        497,
        482,
        468,
        454,
        441,
        428,
        417,
        405,
        394,
        383,
        373,
        364,
        354,
        345,
        337,
        328,
        320,
        312,
        305,
        298,
        291,
        284,
        278,
        271,
        265,
        259,
        507,
        496,
        485,
        475,
        465,
        456,
        446,
        437,
        428,
        420,
        412,
        404,
        396,
        388,
        381,
        374,
        367,
        360,
        354,
        347,
        341,
        335,
        329,
        323,
        318,
        312,
        307,
        302,
        297,
        292,
        287,
        282,
        278,
        273,
        269,
        265,
        261,
        512,
        505,
        497,
        489,
        482,
        475,
        468,
        461,
        454,
        447,
        441,
        435,
        428,
        422,
        417,
        411,
        405,
        399,
        394,
        389,
        383,
        378,
        373,
        368,
        364,
        359,
        354,
        350,
        345,
        341,
        337,
        332,
        328,
        324,
        320,
        316,
        312,
        309,
        305,
        301,
        298,
        294,
        291,
        287,
        284,
        281,
        278,
        274,
        271,
        268,
        265,
        262,
        259,
        257,
        507,
        501,
        496,
        491,
        485,
        480,
        475,
        470,
        465,
        460,
        456,
        451,
        446,
        442,
        437,
        433,
        428,
        424,
        420,
        416,
        412,
        408,
        404,
        400,
        396,
        392,
        388,
        385,
        381,
        377,
        374,
        370,
        367,
        363,
        360,
        357,
        354,
        350,
        347,
        344,
        341,
        338,
        335,
        332,
        329,
        326,
        323,
        320,
        318,
        315,
        312,
        310,
        307,
        304,
        302,
        299,
        297,
        294,
        292,
        289,
        287,
        285,
        282,
        280,
        278,
        275,
        273,
        271,
        269,
        267,
        265,
        263,
        261,
        259
    ];
    var shg_table = [
        9,
        11,
        12,
        13,
        13,
        14,
        14,
        15,
        15,
        15,
        15,
        16,
        16,
        16,
        16,
        17,
        17,
        17,
        17,
        17,
        17,
        17,
        18,
        18,
        18,
        18,
        18,
        18,
        18,
        18,
        18,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        19,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        20,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        21,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        22,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        23,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24,
        24
    ];
    function filterGaussBlurRGBA(imageData, radius) {
        var pixels = imageData.data, width = imageData.width, height = imageData.height;
        var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum, a_sum, r_out_sum, g_out_sum, b_out_sum, a_out_sum, r_in_sum, g_in_sum, b_in_sum, a_in_sum, pr, pg, pb, pa, rbs;
        var div = radius + radius + 1, widthMinus1 = width - 1, heightMinus1 = height - 1, radiusPlus1 = radius + 1, sumFactor = (radiusPlus1 * (radiusPlus1 + 1)) / 2, stackStart = new BlurStack(), stackEnd = null, stack = stackStart, stackIn = null, stackOut = null, mul_sum = mul_table[radius], shg_sum = shg_table[radius];
        for (i = 1; i < div; i++) {
            stack = stack.next = new BlurStack();
            if (i === radiusPlus1) {
                stackEnd = stack;
            }
        }
        stack.next = stackStart;
        yw = yi = 0;
        for (y = 0; y < height; y++) {
            r_in_sum = g_in_sum = b_in_sum = a_in_sum = r_sum = g_sum = b_sum = a_sum = 0;
            r_out_sum = radiusPlus1 * (pr = pixels[yi]);
            g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
            b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);
            a_out_sum = radiusPlus1 * (pa = pixels[yi + 3]);
            r_sum += sumFactor * pr;
            g_sum += sumFactor * pg;
            b_sum += sumFactor * pb;
            a_sum += sumFactor * pa;
            stack = stackStart;
            for (i = 0; i < radiusPlus1; i++) {
                stack.r = pr;
                stack.g = pg;
                stack.b = pb;
                stack.a = pa;
                stack = stack.next;
            }
            for (i = 1; i < radiusPlus1; i++) {
                p = yi + ((widthMinus1 < i ? widthMinus1 : i) << 2);
                r_sum += (stack.r = pr = pixels[p]) * (rbs = radiusPlus1 - i);
                g_sum += (stack.g = pg = pixels[p + 1]) * rbs;
                b_sum += (stack.b = pb = pixels[p + 2]) * rbs;
                a_sum += (stack.a = pa = pixels[p + 3]) * rbs;
                r_in_sum += pr;
                g_in_sum += pg;
                b_in_sum += pb;
                a_in_sum += pa;
                stack = stack.next;
            }
            stackIn = stackStart;
            stackOut = stackEnd;
            for (x = 0; x < width; x++) {
                pixels[yi + 3] = pa = (a_sum * mul_sum) >> shg_sum;
                if (pa !== 0) {
                    pa = 255 / pa;
                    pixels[yi] = ((r_sum * mul_sum) >> shg_sum) * pa;
                    pixels[yi + 1] = ((g_sum * mul_sum) >> shg_sum) * pa;
                    pixels[yi + 2] = ((b_sum * mul_sum) >> shg_sum) * pa;
                }
                else {
                    pixels[yi] = pixels[yi + 1] = pixels[yi + 2] = 0;
                }
                r_sum -= r_out_sum;
                g_sum -= g_out_sum;
                b_sum -= b_out_sum;
                a_sum -= a_out_sum;
                r_out_sum -= stackIn.r;
                g_out_sum -= stackIn.g;
                b_out_sum -= stackIn.b;
                a_out_sum -= stackIn.a;
                p = (yw + ((p = x + radius + 1) < widthMinus1 ? p : widthMinus1)) << 2;
                r_in_sum += stackIn.r = pixels[p];
                g_in_sum += stackIn.g = pixels[p + 1];
                b_in_sum += stackIn.b = pixels[p + 2];
                a_in_sum += stackIn.a = pixels[p + 3];
                r_sum += r_in_sum;
                g_sum += g_in_sum;
                b_sum += b_in_sum;
                a_sum += a_in_sum;
                stackIn = stackIn.next;
                r_out_sum += pr = stackOut.r;
                g_out_sum += pg = stackOut.g;
                b_out_sum += pb = stackOut.b;
                a_out_sum += pa = stackOut.a;
                r_in_sum -= pr;
                g_in_sum -= pg;
                b_in_sum -= pb;
                a_in_sum -= pa;
                stackOut = stackOut.next;
                yi += 4;
            }
            yw += width;
        }
        for (x = 0; x < width; x++) {
            g_in_sum = b_in_sum = a_in_sum = r_in_sum = g_sum = b_sum = a_sum = r_sum = 0;
            yi = x << 2;
            r_out_sum = radiusPlus1 * (pr = pixels[yi]);
            g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
            b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);
            a_out_sum = radiusPlus1 * (pa = pixels[yi + 3]);
            r_sum += sumFactor * pr;
            g_sum += sumFactor * pg;
            b_sum += sumFactor * pb;
            a_sum += sumFactor * pa;
            stack = stackStart;
            for (i = 0; i < radiusPlus1; i++) {
                stack.r = pr;
                stack.g = pg;
                stack.b = pb;
                stack.a = pa;
                stack = stack.next;
            }
            yp = width;
            for (i = 1; i <= radius; i++) {
                yi = (yp + x) << 2;
                r_sum += (stack.r = pr = pixels[yi]) * (rbs = radiusPlus1 - i);
                g_sum += (stack.g = pg = pixels[yi + 1]) * rbs;
                b_sum += (stack.b = pb = pixels[yi + 2]) * rbs;
                a_sum += (stack.a = pa = pixels[yi + 3]) * rbs;
                r_in_sum += pr;
                g_in_sum += pg;
                b_in_sum += pb;
                a_in_sum += pa;
                stack = stack.next;
                if (i < heightMinus1) {
                    yp += width;
                }
            }
            yi = x;
            stackIn = stackStart;
            stackOut = stackEnd;
            for (y = 0; y < height; y++) {
                p = yi << 2;
                pixels[p + 3] = pa = (a_sum * mul_sum) >> shg_sum;
                if (pa > 0) {
                    pa = 255 / pa;
                    pixels[p] = ((r_sum * mul_sum) >> shg_sum) * pa;
                    pixels[p + 1] = ((g_sum * mul_sum) >> shg_sum) * pa;
                    pixels[p + 2] = ((b_sum * mul_sum) >> shg_sum) * pa;
                }
                else {
                    pixels[p] = pixels[p + 1] = pixels[p + 2] = 0;
                }
                r_sum -= r_out_sum;
                g_sum -= g_out_sum;
                b_sum -= b_out_sum;
                a_sum -= a_out_sum;
                r_out_sum -= stackIn.r;
                g_out_sum -= stackIn.g;
                b_out_sum -= stackIn.b;
                a_out_sum -= stackIn.a;
                p =
                    (x +
                        ((p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1) * width) <<
                        2;
                r_sum += r_in_sum += stackIn.r = pixels[p];
                g_sum += g_in_sum += stackIn.g = pixels[p + 1];
                b_sum += b_in_sum += stackIn.b = pixels[p + 2];
                a_sum += a_in_sum += stackIn.a = pixels[p + 3];
                stackIn = stackIn.next;
                r_out_sum += pr = stackOut.r;
                g_out_sum += pg = stackOut.g;
                b_out_sum += pb = stackOut.b;
                a_out_sum += pa = stackOut.a;
                r_in_sum -= pr;
                g_in_sum -= pg;
                b_in_sum -= pb;
                a_in_sum -= pa;
                stackOut = stackOut.next;
                yi += width;
            }
        }
    }
    exports.Blur = function Blur(imageData) {
        var radius = Math.round(this.blurRadius());
        if (radius > 0) {
            filterGaussBlurRGBA(imageData, radius);
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'blurRadius', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Brighten = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.Brighten = function (imageData) {
        var brightness = this.brightness() * 255, data = imageData.data, len = data.length, i;
        for (i = 0; i < len; i += 4) {
            data[i] += brightness;
            data[i + 1] += brightness;
            data[i + 2] += brightness;
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'brightness', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Contrast = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.Contrast = function (imageData) {
        var adjust = Math.pow((this.contrast() + 100) / 100, 2);
        var data = imageData.data, nPixels = data.length, red = 150, green = 150, blue = 150, i;
        for (i = 0; i < nPixels; i += 4) {
            red = data[i];
            green = data[i + 1];
            blue = data[i + 2];
            red /= 255;
            red -= 0.5;
            red *= adjust;
            red += 0.5;
            red *= 255;
            green /= 255;
            green -= 0.5;
            green *= adjust;
            green += 0.5;
            green *= 255;
            blue /= 255;
            blue -= 0.5;
            blue *= adjust;
            blue += 0.5;
            blue *= 255;
            red = red < 0 ? 0 : red > 255 ? 255 : red;
            green = green < 0 ? 0 : green > 255 ? 255 : green;
            blue = blue < 0 ? 0 : blue > 255 ? 255 : blue;
            data[i] = red;
            data[i + 1] = green;
            data[i + 2] = blue;
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'contrast', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Emboss = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });




    exports.Emboss = function (imageData) {
        var strength = this.embossStrength() * 10, greyLevel = this.embossWhiteLevel() * 255, direction = this.embossDirection(), blend = this.embossBlend(), dirY = 0, dirX = 0, data = imageData.data, w = imageData.width, h = imageData.height, w4 = w * 4, y = h;
        switch (direction) {
            case 'top-left':
                dirY = -1;
                dirX = -1;
                break;
            case 'top':
                dirY = -1;
                dirX = 0;
                break;
            case 'top-right':
                dirY = -1;
                dirX = 1;
                break;
            case 'right':
                dirY = 0;
                dirX = 1;
                break;
            case 'bottom-right':
                dirY = 1;
                dirX = 1;
                break;
            case 'bottom':
                dirY = 1;
                dirX = 0;
                break;
            case 'bottom-left':
                dirY = 1;
                dirX = -1;
                break;
            case 'left':
                dirY = 0;
                dirX = -1;
                break;
            default:
                Util.Util.error('Unknown emboss direction: ' + direction);
        }
        do {
            var offsetY = (y - 1) * w4;
            var otherY = dirY;
            if (y + otherY < 1) {
                otherY = 0;
            }
            if (y + otherY > h) {
                otherY = 0;
            }
            var offsetYOther = (y - 1 + otherY) * w * 4;
            var x = w;
            do {
                var offset = offsetY + (x - 1) * 4;
                var otherX = dirX;
                if (x + otherX < 1) {
                    otherX = 0;
                }
                if (x + otherX > w) {
                    otherX = 0;
                }
                var offsetOther = offsetYOther + (x - 1 + otherX) * 4;
                var dR = data[offset] - data[offsetOther];
                var dG = data[offset + 1] - data[offsetOther + 1];
                var dB = data[offset + 2] - data[offsetOther + 2];
                var dif = dR;
                var absDif = dif > 0 ? dif : -dif;
                var absG = dG > 0 ? dG : -dG;
                var absB = dB > 0 ? dB : -dB;
                if (absG > absDif) {
                    dif = dG;
                }
                if (absB > absDif) {
                    dif = dB;
                }
                dif *= strength;
                if (blend) {
                    var r = data[offset] + dif;
                    var g = data[offset + 1] + dif;
                    var b = data[offset + 2] + dif;
                    data[offset] = r > 255 ? 255 : r < 0 ? 0 : r;
                    data[offset + 1] = g > 255 ? 255 : g < 0 ? 0 : g;
                    data[offset + 2] = b > 255 ? 255 : b < 0 ? 0 : b;
                }
                else {
                    var grey = greyLevel - dif;
                    if (grey < 0) {
                        grey = 0;
                    }
                    else if (grey > 255) {
                        grey = 255;
                    }
                    data[offset] = data[offset + 1] = data[offset + 2] = grey;
                }
            } while (--x);
        } while (--y);
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'embossStrength', 0.5, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'embossWhiteLevel', 0.5, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'embossDirection', 'top-left', null, Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'embossBlend', false, null, Factory.Factory.afterSetFilter);
    });

    var Enhance = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    function remap(fromValue, fromMin, fromMax, toMin, toMax) {
        var fromRange = fromMax - fromMin, toRange = toMax - toMin, toValue;
        if (fromRange === 0) {
            return toMin + toRange / 2;
        }
        if (toRange === 0) {
            return toMin;
        }
        toValue = (fromValue - fromMin) / fromRange;
        toValue = toRange * toValue + toMin;
        return toValue;
    }
    exports.Enhance = function (imageData) {
        var data = imageData.data, nSubPixels = data.length, rMin = data[0], rMax = rMin, r, gMin = data[1], gMax = gMin, g, bMin = data[2], bMax = bMin, b, i;
        var enhanceAmount = this.enhance();
        if (enhanceAmount === 0) {
            return;
        }
        for (i = 0; i < nSubPixels; i += 4) {
            r = data[i + 0];
            if (r < rMin) {
                rMin = r;
            }
            else if (r > rMax) {
                rMax = r;
            }
            g = data[i + 1];
            if (g < gMin) {
                gMin = g;
            }
            else if (g > gMax) {
                gMax = g;
            }
            b = data[i + 2];
            if (b < bMin) {
                bMin = b;
            }
            else if (b > bMax) {
                bMax = b;
            }
        }
        if (rMax === rMin) {
            rMax = 255;
            rMin = 0;
        }
        if (gMax === gMin) {
            gMax = 255;
            gMin = 0;
        }
        if (bMax === bMin) {
            bMax = 255;
            bMin = 0;
        }
        var rMid, rGoalMax, rGoalMin, gMid, gGoalMax, gGoalMin, bMid, bGoalMax, bGoalMin;
        if (enhanceAmount > 0) {
            rGoalMax = rMax + enhanceAmount * (255 - rMax);
            rGoalMin = rMin - enhanceAmount * (rMin - 0);
            gGoalMax = gMax + enhanceAmount * (255 - gMax);
            gGoalMin = gMin - enhanceAmount * (gMin - 0);
            bGoalMax = bMax + enhanceAmount * (255 - bMax);
            bGoalMin = bMin - enhanceAmount * (bMin - 0);
        }
        else {
            rMid = (rMax + rMin) * 0.5;
            rGoalMax = rMax + enhanceAmount * (rMax - rMid);
            rGoalMin = rMin + enhanceAmount * (rMin - rMid);
            gMid = (gMax + gMin) * 0.5;
            gGoalMax = gMax + enhanceAmount * (gMax - gMid);
            gGoalMin = gMin + enhanceAmount * (gMin - gMid);
            bMid = (bMax + bMin) * 0.5;
            bGoalMax = bMax + enhanceAmount * (bMax - bMid);
            bGoalMin = bMin + enhanceAmount * (bMin - bMid);
        }
        for (i = 0; i < nSubPixels; i += 4) {
            data[i + 0] = remap(data[i + 0], rMin, rMax, rGoalMin, rGoalMax);
            data[i + 1] = remap(data[i + 1], gMin, gMax, gGoalMin, gGoalMax);
            data[i + 2] = remap(data[i + 2], bMin, bMax, bGoalMin, bGoalMax);
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'enhance', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Grayscale = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Grayscale = function (imageData) {
        var data = imageData.data, len = data.length, i, brightness;
        for (i = 0; i < len; i += 4) {
            brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
            data[i] = brightness;
            data[i + 1] = brightness;
            data[i + 2] = brightness;
        }
    };
    });

    var HSL = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    Factory.Factory.addGetterSetter(Node_1.Node, 'hue', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'saturation', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'luminance', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    exports.HSL = function (imageData) {
        var data = imageData.data, nPixels = data.length, v = 1, s = Math.pow(2, this.saturation()), h = Math.abs(this.hue() + 360) % 360, l = this.luminance() * 127, i;
        var vsu = v * s * Math.cos((h * Math.PI) / 180), vsw = v * s * Math.sin((h * Math.PI) / 180);
        var rr = 0.299 * v + 0.701 * vsu + 0.167 * vsw, rg = 0.587 * v - 0.587 * vsu + 0.33 * vsw, rb = 0.114 * v - 0.114 * vsu - 0.497 * vsw;
        var gr = 0.299 * v - 0.299 * vsu - 0.328 * vsw, gg = 0.587 * v + 0.413 * vsu + 0.035 * vsw, gb = 0.114 * v - 0.114 * vsu + 0.293 * vsw;
        var br = 0.299 * v - 0.3 * vsu + 1.25 * vsw, bg = 0.587 * v - 0.586 * vsu - 1.05 * vsw, bb = 0.114 * v + 0.886 * vsu - 0.2 * vsw;
        var r, g, b, a;
        for (i = 0; i < nPixels; i += 4) {
            r = data[i + 0];
            g = data[i + 1];
            b = data[i + 2];
            a = data[i + 3];
            data[i + 0] = rr * r + rg * g + rb * b + l;
            data[i + 1] = gr * r + gg * g + gb * b + l;
            data[i + 2] = br * r + bg * g + bb * b + l;
            data[i + 3] = a;
        }
    };
    });

    var HSV = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.HSV = function (imageData) {
        var data = imageData.data, nPixels = data.length, v = Math.pow(2, this.value()), s = Math.pow(2, this.saturation()), h = Math.abs(this.hue() + 360) % 360, i;
        var vsu = v * s * Math.cos((h * Math.PI) / 180), vsw = v * s * Math.sin((h * Math.PI) / 180);
        var rr = 0.299 * v + 0.701 * vsu + 0.167 * vsw, rg = 0.587 * v - 0.587 * vsu + 0.33 * vsw, rb = 0.114 * v - 0.114 * vsu - 0.497 * vsw;
        var gr = 0.299 * v - 0.299 * vsu - 0.328 * vsw, gg = 0.587 * v + 0.413 * vsu + 0.035 * vsw, gb = 0.114 * v - 0.114 * vsu + 0.293 * vsw;
        var br = 0.299 * v - 0.3 * vsu + 1.25 * vsw, bg = 0.587 * v - 0.586 * vsu - 1.05 * vsw, bb = 0.114 * v + 0.886 * vsu - 0.2 * vsw;
        var r, g, b, a;
        for (i = 0; i < nPixels; i += 4) {
            r = data[i + 0];
            g = data[i + 1];
            b = data[i + 2];
            a = data[i + 3];
            data[i + 0] = rr * r + rg * g + rb * b;
            data[i + 1] = gr * r + gg * g + gb * b;
            data[i + 2] = br * r + bg * g + bb * b;
            data[i + 3] = a;
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'hue', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'saturation', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'value', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Invert = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Invert = function (imageData) {
        var data = imageData.data, len = data.length, i;
        for (i = 0; i < len; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }
    };
    });

    var Kaleidoscope = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });




    var ToPolar = function (src, dst, opt) {
        var srcPixels = src.data, dstPixels = dst.data, xSize = src.width, ySize = src.height, xMid = opt.polarCenterX || xSize / 2, yMid = opt.polarCenterY || ySize / 2, i, x, y, r = 0, g = 0, b = 0, a = 0;
        var rad, rMax = Math.sqrt(xMid * xMid + yMid * yMid);
        x = xSize - xMid;
        y = ySize - yMid;
        rad = Math.sqrt(x * x + y * y);
        rMax = rad > rMax ? rad : rMax;
        var rSize = ySize, tSize = xSize, radius, theta;
        var conversion = ((360 / tSize) * Math.PI) / 180, sin, cos;
        for (theta = 0; theta < tSize; theta += 1) {
            sin = Math.sin(theta * conversion);
            cos = Math.cos(theta * conversion);
            for (radius = 0; radius < rSize; radius += 1) {
                x = Math.floor(xMid + ((rMax * radius) / rSize) * cos);
                y = Math.floor(yMid + ((rMax * radius) / rSize) * sin);
                i = (y * xSize + x) * 4;
                r = srcPixels[i + 0];
                g = srcPixels[i + 1];
                b = srcPixels[i + 2];
                a = srcPixels[i + 3];
                i = (theta + radius * xSize) * 4;
                dstPixels[i + 0] = r;
                dstPixels[i + 1] = g;
                dstPixels[i + 2] = b;
                dstPixels[i + 3] = a;
            }
        }
    };
    var FromPolar = function (src, dst, opt) {
        var srcPixels = src.data, dstPixels = dst.data, xSize = src.width, ySize = src.height, xMid = opt.polarCenterX || xSize / 2, yMid = opt.polarCenterY || ySize / 2, i, x, y, dx, dy, r = 0, g = 0, b = 0, a = 0;
        var rad, rMax = Math.sqrt(xMid * xMid + yMid * yMid);
        x = xSize - xMid;
        y = ySize - yMid;
        rad = Math.sqrt(x * x + y * y);
        rMax = rad > rMax ? rad : rMax;
        var rSize = ySize, tSize = xSize, radius, theta, phaseShift = opt.polarRotation || 0;
        var x1, y1;
        for (x = 0; x < xSize; x += 1) {
            for (y = 0; y < ySize; y += 1) {
                dx = x - xMid;
                dy = y - yMid;
                radius = (Math.sqrt(dx * dx + dy * dy) * rSize) / rMax;
                theta = ((Math.atan2(dy, dx) * 180) / Math.PI + 360 + phaseShift) % 360;
                theta = (theta * tSize) / 360;
                x1 = Math.floor(theta);
                y1 = Math.floor(radius);
                i = (y1 * xSize + x1) * 4;
                r = srcPixels[i + 0];
                g = srcPixels[i + 1];
                b = srcPixels[i + 2];
                a = srcPixels[i + 3];
                i = (y * xSize + x) * 4;
                dstPixels[i + 0] = r;
                dstPixels[i + 1] = g;
                dstPixels[i + 2] = b;
                dstPixels[i + 3] = a;
            }
        }
    };
    exports.Kaleidoscope = function (imageData) {
        var xSize = imageData.width, ySize = imageData.height;
        var x, y, xoff, i, r, g, b, a, srcPos, dstPos;
        var power = Math.round(this.kaleidoscopePower());
        var angle = Math.round(this.kaleidoscopeAngle());
        var offset = Math.floor((xSize * (angle % 360)) / 360);
        if (power < 1) {
            return;
        }
        var tempCanvas = Util.Util.createCanvasElement();
        tempCanvas.width = xSize;
        tempCanvas.height = ySize;
        var scratchData = tempCanvas
            .getContext('2d')
            .getImageData(0, 0, xSize, ySize);
        ToPolar(imageData, scratchData, {
            polarCenterX: xSize / 2,
            polarCenterY: ySize / 2
        });
        var minSectionSize = xSize / Math.pow(2, power);
        while (minSectionSize <= 8) {
            minSectionSize = minSectionSize * 2;
            power -= 1;
        }
        minSectionSize = Math.ceil(minSectionSize);
        var sectionSize = minSectionSize;
        var xStart = 0, xEnd = sectionSize, xDelta = 1;
        if (offset + minSectionSize > xSize) {
            xStart = sectionSize;
            xEnd = 0;
            xDelta = -1;
        }
        for (y = 0; y < ySize; y += 1) {
            for (x = xStart; x !== xEnd; x += xDelta) {
                xoff = Math.round(x + offset) % xSize;
                srcPos = (xSize * y + xoff) * 4;
                r = scratchData.data[srcPos + 0];
                g = scratchData.data[srcPos + 1];
                b = scratchData.data[srcPos + 2];
                a = scratchData.data[srcPos + 3];
                dstPos = (xSize * y + x) * 4;
                scratchData.data[dstPos + 0] = r;
                scratchData.data[dstPos + 1] = g;
                scratchData.data[dstPos + 2] = b;
                scratchData.data[dstPos + 3] = a;
            }
        }
        for (y = 0; y < ySize; y += 1) {
            sectionSize = Math.floor(minSectionSize);
            for (i = 0; i < power; i += 1) {
                for (x = 0; x < sectionSize + 1; x += 1) {
                    srcPos = (xSize * y + x) * 4;
                    r = scratchData.data[srcPos + 0];
                    g = scratchData.data[srcPos + 1];
                    b = scratchData.data[srcPos + 2];
                    a = scratchData.data[srcPos + 3];
                    dstPos = (xSize * y + sectionSize * 2 - x - 1) * 4;
                    scratchData.data[dstPos + 0] = r;
                    scratchData.data[dstPos + 1] = g;
                    scratchData.data[dstPos + 2] = b;
                    scratchData.data[dstPos + 3] = a;
                }
                sectionSize *= 2;
            }
        }
        FromPolar(scratchData, imageData, { polarRotation: 0 });
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'kaleidoscopePower', 2, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'kaleidoscopeAngle', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Mask = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    function pixelAt(idata, x, y) {
        var idx = (y * idata.width + x) * 4;
        var d = [];
        d.push(idata.data[idx++], idata.data[idx++], idata.data[idx++], idata.data[idx++]);
        return d;
    }
    function rgbDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) +
            Math.pow(p1[1] - p2[1], 2) +
            Math.pow(p1[2] - p2[2], 2));
    }
    function rgbMean(pTab) {
        var m = [0, 0, 0];
        for (var i = 0; i < pTab.length; i++) {
            m[0] += pTab[i][0];
            m[1] += pTab[i][1];
            m[2] += pTab[i][2];
        }
        m[0] /= pTab.length;
        m[1] /= pTab.length;
        m[2] /= pTab.length;
        return m;
    }
    function backgroundMask(idata, threshold) {
        var rgbv_no = pixelAt(idata, 0, 0);
        var rgbv_ne = pixelAt(idata, idata.width - 1, 0);
        var rgbv_so = pixelAt(idata, 0, idata.height - 1);
        var rgbv_se = pixelAt(idata, idata.width - 1, idata.height - 1);
        var thres = threshold || 10;
        if (rgbDistance(rgbv_no, rgbv_ne) < thres &&
            rgbDistance(rgbv_ne, rgbv_se) < thres &&
            rgbDistance(rgbv_se, rgbv_so) < thres &&
            rgbDistance(rgbv_so, rgbv_no) < thres) {
            var mean = rgbMean([rgbv_ne, rgbv_no, rgbv_se, rgbv_so]);
            var mask = [];
            for (var i = 0; i < idata.width * idata.height; i++) {
                var d = rgbDistance(mean, [
                    idata.data[i * 4],
                    idata.data[i * 4 + 1],
                    idata.data[i * 4 + 2]
                ]);
                mask[i] = d < thres ? 0 : 255;
            }
            return mask;
        }
    }
    function applyMask(idata, mask) {
        for (var i = 0; i < idata.width * idata.height; i++) {
            idata.data[4 * i + 3] = mask[i];
        }
    }
    function erodeMask(mask, sw, sh) {
        var weights = [1, 1, 1, 1, 0, 1, 1, 1, 1];
        var side = Math.round(Math.sqrt(weights.length));
        var halfSide = Math.floor(side / 2);
        var maskResult = [];
        for (var y = 0; y < sh; y++) {
            for (var x = 0; x < sw; x++) {
                var so = y * sw + x;
                var a = 0;
                for (var cy = 0; cy < side; cy++) {
                    for (var cx = 0; cx < side; cx++) {
                        var scy = y + cy - halfSide;
                        var scx = x + cx - halfSide;
                        if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
                            var srcOff = scy * sw + scx;
                            var wt = weights[cy * side + cx];
                            a += mask[srcOff] * wt;
                        }
                    }
                }
                maskResult[so] = a === 255 * 8 ? 255 : 0;
            }
        }
        return maskResult;
    }
    function dilateMask(mask, sw, sh) {
        var weights = [1, 1, 1, 1, 1, 1, 1, 1, 1];
        var side = Math.round(Math.sqrt(weights.length));
        var halfSide = Math.floor(side / 2);
        var maskResult = [];
        for (var y = 0; y < sh; y++) {
            for (var x = 0; x < sw; x++) {
                var so = y * sw + x;
                var a = 0;
                for (var cy = 0; cy < side; cy++) {
                    for (var cx = 0; cx < side; cx++) {
                        var scy = y + cy - halfSide;
                        var scx = x + cx - halfSide;
                        if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
                            var srcOff = scy * sw + scx;
                            var wt = weights[cy * side + cx];
                            a += mask[srcOff] * wt;
                        }
                    }
                }
                maskResult[so] = a >= 255 * 4 ? 255 : 0;
            }
        }
        return maskResult;
    }
    function smoothEdgeMask(mask, sw, sh) {
        var weights = [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9];
        var side = Math.round(Math.sqrt(weights.length));
        var halfSide = Math.floor(side / 2);
        var maskResult = [];
        for (var y = 0; y < sh; y++) {
            for (var x = 0; x < sw; x++) {
                var so = y * sw + x;
                var a = 0;
                for (var cy = 0; cy < side; cy++) {
                    for (var cx = 0; cx < side; cx++) {
                        var scy = y + cy - halfSide;
                        var scx = x + cx - halfSide;
                        if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
                            var srcOff = scy * sw + scx;
                            var wt = weights[cy * side + cx];
                            a += mask[srcOff] * wt;
                        }
                    }
                }
                maskResult[so] = a;
            }
        }
        return maskResult;
    }
    exports.Mask = function (imageData) {
        var threshold = this.threshold(), mask = backgroundMask(imageData, threshold);
        if (mask) {
            mask = erodeMask(mask, imageData.width, imageData.height);
            mask = dilateMask(mask, imageData.width, imageData.height);
            mask = smoothEdgeMask(mask, imageData.width, imageData.height);
            applyMask(imageData, mask);
        }
        return imageData;
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'threshold', 0, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Noise = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.Noise = function (imageData) {
        var amount = this.noise() * 255, data = imageData.data, nPixels = data.length, half = amount / 2, i;
        for (i = 0; i < nPixels; i += 4) {
            data[i + 0] += half - 2 * half * Math.random();
            data[i + 1] += half - 2 * half * Math.random();
            data[i + 2] += half - 2 * half * Math.random();
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'noise', 0.2, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Pixelate = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });




    exports.Pixelate = function (imageData) {
        var pixelSize = Math.ceil(this.pixelSize()), width = imageData.width, height = imageData.height, x, y, i, red, green, blue, alpha, nBinsX = Math.ceil(width / pixelSize), nBinsY = Math.ceil(height / pixelSize), xBinStart, xBinEnd, yBinStart, yBinEnd, xBin, yBin, pixelsInBin, data = imageData.data;
        if (pixelSize <= 0) {
            Util.Util.error('pixelSize value can not be <= 0');
            return;
        }
        for (xBin = 0; xBin < nBinsX; xBin += 1) {
            for (yBin = 0; yBin < nBinsY; yBin += 1) {
                red = 0;
                green = 0;
                blue = 0;
                alpha = 0;
                xBinStart = xBin * pixelSize;
                xBinEnd = xBinStart + pixelSize;
                yBinStart = yBin * pixelSize;
                yBinEnd = yBinStart + pixelSize;
                pixelsInBin = 0;
                for (x = xBinStart; x < xBinEnd; x += 1) {
                    if (x >= width) {
                        continue;
                    }
                    for (y = yBinStart; y < yBinEnd; y += 1) {
                        if (y >= height) {
                            continue;
                        }
                        i = (width * y + x) * 4;
                        red += data[i + 0];
                        green += data[i + 1];
                        blue += data[i + 2];
                        alpha += data[i + 3];
                        pixelsInBin += 1;
                    }
                }
                red = red / pixelsInBin;
                green = green / pixelsInBin;
                blue = blue / pixelsInBin;
                alpha = alpha / pixelsInBin;
                for (x = xBinStart; x < xBinEnd; x += 1) {
                    if (x >= width) {
                        continue;
                    }
                    for (y = yBinStart; y < yBinEnd; y += 1) {
                        if (y >= height) {
                            continue;
                        }
                        i = (width * y + x) * 4;
                        data[i + 0] = red;
                        data[i + 1] = green;
                        data[i + 2] = blue;
                        data[i + 3] = alpha;
                    }
                }
            }
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'pixelSize', 8, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var Posterize = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.Posterize = function (imageData) {
        var levels = Math.round(this.levels() * 254) + 1, data = imageData.data, len = data.length, scale = 255 / levels, i;
        for (i = 0; i < len; i += 1) {
            data[i] = Math.floor(data[i] / scale) * scale;
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'levels', 0.5, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var RGB = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.RGB = function (imageData) {
        var data = imageData.data, nPixels = data.length, red = this.red(), green = this.green(), blue = this.blue(), i, brightness;
        for (i = 0; i < nPixels; i += 4) {
            brightness =
                (0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2]) / 255;
            data[i] = brightness * red;
            data[i + 1] = brightness * green;
            data[i + 2] = brightness * blue;
            data[i + 3] = data[i + 3];
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'red', 0, function (val) {
        this._filterUpToDate = false;
        if (val > 255) {
            return 255;
        }
        else if (val < 0) {
            return 0;
        }
        else {
            return Math.round(val);
        }
    });
    Factory.Factory.addGetterSetter(Node_1.Node, 'green', 0, function (val) {
        this._filterUpToDate = false;
        if (val > 255) {
            return 255;
        }
        else if (val < 0) {
            return 0;
        }
        else {
            return Math.round(val);
        }
    });
    Factory.Factory.addGetterSetter(Node_1.Node, 'blue', 0, Validators.RGBComponent, Factory.Factory.afterSetFilter);
    });

    var RGBA = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.RGBA = function (imageData) {
        var data = imageData.data, nPixels = data.length, red = this.red(), green = this.green(), blue = this.blue(), alpha = this.alpha(), i, ia;
        for (i = 0; i < nPixels; i += 4) {
            ia = 1 - alpha;
            data[i] = red * alpha + data[i] * ia;
            data[i + 1] = green * alpha + data[i + 1] * ia;
            data[i + 2] = blue * alpha + data[i + 2] * ia;
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'red', 0, function (val) {
        this._filterUpToDate = false;
        if (val > 255) {
            return 255;
        }
        else if (val < 0) {
            return 0;
        }
        else {
            return Math.round(val);
        }
    });
    Factory.Factory.addGetterSetter(Node_1.Node, 'green', 0, function (val) {
        this._filterUpToDate = false;
        if (val > 255) {
            return 255;
        }
        else if (val < 0) {
            return 0;
        }
        else {
            return Math.round(val);
        }
    });
    Factory.Factory.addGetterSetter(Node_1.Node, 'blue', 0, Validators.RGBComponent, Factory.Factory.afterSetFilter);
    Factory.Factory.addGetterSetter(Node_1.Node, 'alpha', 1, function (val) {
        this._filterUpToDate = false;
        if (val > 1) {
            return 1;
        }
        else if (val < 0) {
            return 0;
        }
        else {
            return val;
        }
    });
    });

    var Sepia = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Sepia = function (imageData) {
        var data = imageData.data, nPixels = data.length, i, r, g, b;
        for (i = 0; i < nPixels; i += 4) {
            r = data[i + 0];
            g = data[i + 1];
            b = data[i + 2];
            data[i + 0] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
            data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
            data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
    };
    });

    var Solarize = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Solarize = function (imageData) {
        var data = imageData.data, w = imageData.width, h = imageData.height, w4 = w * 4, y = h;
        do {
            var offsetY = (y - 1) * w4;
            var x = w;
            do {
                var offset = offsetY + (x - 1) * 4;
                var r = data[offset];
                var g = data[offset + 1];
                var b = data[offset + 2];
                if (r > 127) {
                    r = 255 - r;
                }
                if (g > 127) {
                    g = 255 - g;
                }
                if (b > 127) {
                    b = 255 - b;
                }
                data[offset] = r;
                data[offset + 1] = g;
                data[offset + 2] = b;
            } while (--x);
        } while (--y);
    };
    });

    var Threshold = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });



    exports.Threshold = function (imageData) {
        var level = this.threshold() * 255, data = imageData.data, len = data.length, i;
        for (i = 0; i < len; i += 1) {
            data[i] = data[i] < level ? 0 : 255;
        }
    };
    Factory.Factory.addGetterSetter(Node_1.Node, 'threshold', 0.5, Validators.getNumberValidator(), Factory.Factory.afterSetFilter);
    });

    var _FullInternals = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });





































    exports.Konva = _CoreInternals.Konva.Util._assign(_CoreInternals.Konva, {
        Arc: Arc_1.Arc,
        Arrow: Arrow_1.Arrow,
        Circle: Circle_1.Circle,
        Ellipse: Ellipse_1.Ellipse,
        Image: Image_1.Image,
        Label: Label_1.Label,
        Tag: Label_1.Tag,
        Line: Line_1.Line,
        Path: Path_1.Path,
        Rect: Rect_1.Rect,
        RegularPolygon: RegularPolygon_1.RegularPolygon,
        Ring: Ring_1.Ring,
        Sprite: Sprite_1.Sprite,
        Star: Star_1.Star,
        Text: Text_1.Text,
        TextPath: TextPath_1.TextPath,
        Transformer: Transformer_1.Transformer,
        Wedge: Wedge_1.Wedge,
        Filters: {
            Blur: Blur.Blur,
            Brighten: Brighten.Brighten,
            Contrast: Contrast.Contrast,
            Emboss: Emboss.Emboss,
            Enhance: Enhance.Enhance,
            Grayscale: Grayscale.Grayscale,
            HSL: HSL.HSL,
            HSV: HSV.HSV,
            Invert: Invert.Invert,
            Kaleidoscope: Kaleidoscope.Kaleidoscope,
            Mask: Mask.Mask,
            Noise: Noise.Noise,
            Pixelate: Pixelate.Pixelate,
            Posterize: Posterize.Posterize,
            RGB: RGB.RGB,
            RGBA: RGBA.RGBA,
            Sepia: Sepia.Sepia,
            Solarize: Solarize.Solarize,
            Threshold: Threshold.Threshold,
        },
    });
    });

    var lib = createCommonjsModule(function (module, exports) {
    var Konva = _FullInternals.Konva;
    Konva._injectGlobal(Konva);
    exports['default'] = Konva;
    module.exports = exports['default'];
    });

    /**
     * Parses an URI
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */

    var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

    var parts = [
        'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
    ];

    var parseuri = function parseuri(str) {
        var src = str,
            b = str.indexOf('['),
            e = str.indexOf(']');

        if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
        }

        var m = re.exec(str || ''),
            uri = {},
            i = 14;

        while (i--) {
            uri[parts[i]] = m[i] || '';
        }

        if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
            uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
            uri.ipv6uri = true;
        }

        return uri;
    };

    /**
     * Helpers.
     */

    var s = 1000;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;

    /**
     * Parse or format the given `val`.
     *
     * Options:
     *
     *  - `long` verbose formatting [false]
     *
     * @param {String|Number} val
     * @param {Object} [options]
     * @throws {Error} throw an error if val is not a non-empty string or a number
     * @return {String|Number}
     * @api public
     */

    var ms = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === 'string' && val.length > 0) {
        return parse(val);
      } else if (type === 'number' && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        'val is not a non-empty string or a valid number. val=' +
          JSON.stringify(val)
      );
    };

    /**
     * Parse the given `str` and return milliseconds.
     *
     * @param {String} str
     * @return {Number}
     * @api private
     */

    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || 'ms').toLowerCase();
      switch (type) {
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
          return n * y;
        case 'weeks':
        case 'week':
        case 'w':
          return n * w;
        case 'days':
        case 'day':
        case 'd':
          return n * d;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
          return n * h;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
          return n * m;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
          return n * s;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
          return n;
        default:
          return undefined;
      }
    }

    /**
     * Short format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + 'd';
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + 'h';
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + 'm';
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + 's';
      }
      return ms + 'ms';
    }

    /**
     * Long format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, 'day');
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, 'hour');
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, 'minute');
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, 'second');
      }
      return ms + ' ms';
    }

    /**
     * Pluralization helper.
     */

    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
    }

    /**
     * This is the common logic for both the Node.js and web browser
     * implementations of `debug()`.
     */

    function setup(env) {
    	createDebug.debug = createDebug;
    	createDebug.default = createDebug;
    	createDebug.coerce = coerce;
    	createDebug.disable = disable;
    	createDebug.enable = enable;
    	createDebug.enabled = enabled;
    	createDebug.humanize = ms;

    	Object.keys(env).forEach(key => {
    		createDebug[key] = env[key];
    	});

    	/**
    	* Active `debug` instances.
    	*/
    	createDebug.instances = [];

    	/**
    	* The currently active debug mode names, and names to skip.
    	*/

    	createDebug.names = [];
    	createDebug.skips = [];

    	/**
    	* Map of special "%n" handling functions, for the debug "format" argument.
    	*
    	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
    	*/
    	createDebug.formatters = {};

    	/**
    	* Selects a color for a debug namespace
    	* @param {String} namespace The namespace string for the for the debug instance to be colored
    	* @return {Number|String} An ANSI color code for the given namespace
    	* @api private
    	*/
    	function selectColor(namespace) {
    		let hash = 0;

    		for (let i = 0; i < namespace.length; i++) {
    			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
    			hash |= 0; // Convert to 32bit integer
    		}

    		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    	}
    	createDebug.selectColor = selectColor;

    	/**
    	* Create a debugger with the given `namespace`.
    	*
    	* @param {String} namespace
    	* @return {Function}
    	* @api public
    	*/
    	function createDebug(namespace) {
    		let prevTime;

    		function debug(...args) {
    			// Disabled?
    			if (!debug.enabled) {
    				return;
    			}

    			const self = debug;

    			// Set `diff` timestamp
    			const curr = Number(new Date());
    			const ms = curr - (prevTime || curr);
    			self.diff = ms;
    			self.prev = prevTime;
    			self.curr = curr;
    			prevTime = curr;

    			args[0] = createDebug.coerce(args[0]);

    			if (typeof args[0] !== 'string') {
    				// Anything else let's inspect with %O
    				args.unshift('%O');
    			}

    			// Apply any `formatters` transformations
    			let index = 0;
    			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
    				// If we encounter an escaped % then don't increase the array index
    				if (match === '%%') {
    					return match;
    				}
    				index++;
    				const formatter = createDebug.formatters[format];
    				if (typeof formatter === 'function') {
    					const val = args[index];
    					match = formatter.call(self, val);

    					// Now we need to remove `args[index]` since it's inlined in the `format`
    					args.splice(index, 1);
    					index--;
    				}
    				return match;
    			});

    			// Apply env-specific formatting (colors, etc.)
    			createDebug.formatArgs.call(self, args);

    			const logFn = self.log || createDebug.log;
    			logFn.apply(self, args);
    		}

    		debug.namespace = namespace;
    		debug.enabled = createDebug.enabled(namespace);
    		debug.useColors = createDebug.useColors();
    		debug.color = selectColor(namespace);
    		debug.destroy = destroy;
    		debug.extend = extend;
    		// Debug.formatArgs = formatArgs;
    		// debug.rawLog = rawLog;

    		// env-specific initialization logic for debug instances
    		if (typeof createDebug.init === 'function') {
    			createDebug.init(debug);
    		}

    		createDebug.instances.push(debug);

    		return debug;
    	}

    	function destroy() {
    		const index = createDebug.instances.indexOf(this);
    		if (index !== -1) {
    			createDebug.instances.splice(index, 1);
    			return true;
    		}
    		return false;
    	}

    	function extend(namespace, delimiter) {
    		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
    		newDebug.log = this.log;
    		return newDebug;
    	}

    	/**
    	* Enables a debug mode by namespaces. This can include modes
    	* separated by a colon and wildcards.
    	*
    	* @param {String} namespaces
    	* @api public
    	*/
    	function enable(namespaces) {
    		createDebug.save(namespaces);

    		createDebug.names = [];
    		createDebug.skips = [];

    		let i;
    		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
    		const len = split.length;

    		for (i = 0; i < len; i++) {
    			if (!split[i]) {
    				// ignore empty strings
    				continue;
    			}

    			namespaces = split[i].replace(/\*/g, '.*?');

    			if (namespaces[0] === '-') {
    				createDebug.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    			} else {
    				createDebug.names.push(new RegExp('^' + namespaces + '$'));
    			}
    		}

    		for (i = 0; i < createDebug.instances.length; i++) {
    			const instance = createDebug.instances[i];
    			instance.enabled = createDebug.enabled(instance.namespace);
    		}
    	}

    	/**
    	* Disable debug output.
    	*
    	* @return {String} namespaces
    	* @api public
    	*/
    	function disable() {
    		const namespaces = [
    			...createDebug.names.map(toNamespace),
    			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
    		].join(',');
    		createDebug.enable('');
    		return namespaces;
    	}

    	/**
    	* Returns true if the given mode name is enabled, false otherwise.
    	*
    	* @param {String} name
    	* @return {Boolean}
    	* @api public
    	*/
    	function enabled(name) {
    		if (name[name.length - 1] === '*') {
    			return true;
    		}

    		let i;
    		let len;

    		for (i = 0, len = createDebug.skips.length; i < len; i++) {
    			if (createDebug.skips[i].test(name)) {
    				return false;
    			}
    		}

    		for (i = 0, len = createDebug.names.length; i < len; i++) {
    			if (createDebug.names[i].test(name)) {
    				return true;
    			}
    		}

    		return false;
    	}

    	/**
    	* Convert regexp to namespace
    	*
    	* @param {RegExp} regxep
    	* @return {String} namespace
    	* @api private
    	*/
    	function toNamespace(regexp) {
    		return regexp.toString()
    			.substring(2, regexp.toString().length - 2)
    			.replace(/\.\*\?$/, '*');
    	}

    	/**
    	* Coerce `val`.
    	*
    	* @param {Mixed} val
    	* @return {Mixed}
    	* @api private
    	*/
    	function coerce(val) {
    		if (val instanceof Error) {
    			return val.stack || val.message;
    		}
    		return val;
    	}

    	createDebug.enable(createDebug.load());

    	return createDebug;
    }

    var common = setup;

    var browser = createCommonjsModule(function (module, exports) {
    /* eslint-env browser */

    /**
     * This is the web browser implementation of `debug()`.
     */

    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();

    /**
     * Colors.
     */

    exports.colors = [
    	'#0000CC',
    	'#0000FF',
    	'#0033CC',
    	'#0033FF',
    	'#0066CC',
    	'#0066FF',
    	'#0099CC',
    	'#0099FF',
    	'#00CC00',
    	'#00CC33',
    	'#00CC66',
    	'#00CC99',
    	'#00CCCC',
    	'#00CCFF',
    	'#3300CC',
    	'#3300FF',
    	'#3333CC',
    	'#3333FF',
    	'#3366CC',
    	'#3366FF',
    	'#3399CC',
    	'#3399FF',
    	'#33CC00',
    	'#33CC33',
    	'#33CC66',
    	'#33CC99',
    	'#33CCCC',
    	'#33CCFF',
    	'#6600CC',
    	'#6600FF',
    	'#6633CC',
    	'#6633FF',
    	'#66CC00',
    	'#66CC33',
    	'#9900CC',
    	'#9900FF',
    	'#9933CC',
    	'#9933FF',
    	'#99CC00',
    	'#99CC33',
    	'#CC0000',
    	'#CC0033',
    	'#CC0066',
    	'#CC0099',
    	'#CC00CC',
    	'#CC00FF',
    	'#CC3300',
    	'#CC3333',
    	'#CC3366',
    	'#CC3399',
    	'#CC33CC',
    	'#CC33FF',
    	'#CC6600',
    	'#CC6633',
    	'#CC9900',
    	'#CC9933',
    	'#CCCC00',
    	'#CCCC33',
    	'#FF0000',
    	'#FF0033',
    	'#FF0066',
    	'#FF0099',
    	'#FF00CC',
    	'#FF00FF',
    	'#FF3300',
    	'#FF3333',
    	'#FF3366',
    	'#FF3399',
    	'#FF33CC',
    	'#FF33FF',
    	'#FF6600',
    	'#FF6633',
    	'#FF9900',
    	'#FF9933',
    	'#FFCC00',
    	'#FFCC33'
    ];

    /**
     * Currently only WebKit-based Web Inspectors, Firefox >= v31,
     * and the Firebug extension (any Firefox version) are known
     * to support "%c" CSS customizations.
     *
     * TODO: add a `localStorage` variable to explicitly enable/disable colors
     */

    // eslint-disable-next-line complexity
    function useColors() {
    	// NB: In an Electron preload script, document will be defined but not fully
    	// initialized. Since we know we're in Chrome, we'll just detect this case
    	// explicitly
    	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
    		return true;
    	}

    	// Internet Explorer and Edge do not support colors.
    	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    		return false;
    	}

    	// Is webkit? http://stackoverflow.com/a/16459606/376773
    	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    		// Is firebug? http://stackoverflow.com/a/398120/376773
    		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    		// Is firefox >= v31?
    		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    		// Double check webkit in userAgent just in case we are in a worker
    		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
    }

    /**
     * Colorize log arguments if enabled.
     *
     * @api public
     */

    function formatArgs(args) {
    	args[0] = (this.useColors ? '%c' : '') +
    		this.namespace +
    		(this.useColors ? ' %c' : ' ') +
    		args[0] +
    		(this.useColors ? '%c ' : ' ') +
    		'+' + module.exports.humanize(this.diff);

    	if (!this.useColors) {
    		return;
    	}

    	const c = 'color: ' + this.color;
    	args.splice(1, 0, c, 'color: inherit');

    	// The final "%c" is somewhat tricky, because there could be other
    	// arguments passed either before or after the %c, so we need to
    	// figure out the correct index to insert the CSS into
    	let index = 0;
    	let lastC = 0;
    	args[0].replace(/%[a-zA-Z%]/g, match => {
    		if (match === '%%') {
    			return;
    		}
    		index++;
    		if (match === '%c') {
    			// We only are interested in the *last* %c
    			// (the user may have provided their own)
    			lastC = index;
    		}
    	});

    	args.splice(lastC, 0, c);
    }

    /**
     * Invokes `console.log()` when available.
     * No-op when `console.log` is not a "function".
     *
     * @api public
     */
    function log(...args) {
    	// This hackery is required for IE8/9, where
    	// the `console.log` function doesn't have 'apply'
    	return typeof console === 'object' &&
    		console.log &&
    		console.log(...args);
    }

    /**
     * Save `namespaces`.
     *
     * @param {String} namespaces
     * @api private
     */
    function save(namespaces) {
    	try {
    		if (namespaces) {
    			exports.storage.setItem('debug', namespaces);
    		} else {
    			exports.storage.removeItem('debug');
    		}
    	} catch (error) {
    		// Swallow
    		// XXX (@Qix-) should we be logging these?
    	}
    }

    /**
     * Load `namespaces`.
     *
     * @return {String} returns the previously persisted debug modes
     * @api private
     */
    function load() {
    	let r;
    	try {
    		r = exports.storage.getItem('debug');
    	} catch (error) {
    		// Swallow
    		// XXX (@Qix-) should we be logging these?
    	}

    	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    	if (!r && typeof process !== 'undefined' && 'env' in process) {
    		r = process.env.DEBUG;
    	}

    	return r;
    }

    /**
     * Localstorage attempts to return the localstorage.
     *
     * This is necessary because safari throws
     * when a user disables cookies/localstorage
     * and you attempt to access it.
     *
     * @return {LocalStorage}
     * @api private
     */

    function localstorage() {
    	try {
    		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
    		// The Browser also has localStorage in the global context.
    		return localStorage;
    	} catch (error) {
    		// Swallow
    		// XXX (@Qix-) should we be logging these?
    	}
    }

    module.exports = common(exports);

    const {formatters} = module.exports;

    /**
     * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
     */

    formatters.j = function (v) {
    	try {
    		return JSON.stringify(v);
    	} catch (error) {
    		return '[UnexpectedJSONParseError]: ' + error.message;
    	}
    };
    });

    /**
     * Module dependencies.
     */


    var debug = browser('socket.io-client:url');

    /**
     * Module exports.
     */

    var url_1 = url;

    /**
     * URL parser.
     *
     * @param {String} url
     * @param {Object} An object meant to mimic window.location.
     *                 Defaults to window.location.
     * @api public
     */

    function url (uri, loc) {
      var obj = uri;

      // default to window.location
      loc = loc || (typeof location !== 'undefined' && location);
      if (null == uri) uri = loc.protocol + '//' + loc.host;

      // relative path support
      if ('string' === typeof uri) {
        if ('/' === uri.charAt(0)) {
          if ('/' === uri.charAt(1)) {
            uri = loc.protocol + uri;
          } else {
            uri = loc.host + uri;
          }
        }

        if (!/^(https?|wss?):\/\//.test(uri)) {
          debug('protocol-less url %s', uri);
          if ('undefined' !== typeof loc) {
            uri = loc.protocol + '//' + uri;
          } else {
            uri = 'https://' + uri;
          }
        }

        // parse
        debug('parse %s', uri);
        obj = parseuri(uri);
      }

      // make sure we treat `localhost:80` and `localhost` equally
      if (!obj.port) {
        if (/^(http|ws)$/.test(obj.protocol)) {
          obj.port = '80';
        } else if (/^(http|ws)s$/.test(obj.protocol)) {
          obj.port = '443';
        }
      }

      obj.path = obj.path || '/';

      var ipv6 = obj.host.indexOf(':') !== -1;
      var host = ipv6 ? '[' + obj.host + ']' : obj.host;

      // define unique id
      obj.id = obj.protocol + '://' + host + ':' + obj.port;
      // define href
      obj.href = obj.protocol + '://' + host + (loc && loc.port === obj.port ? '' : (':' + obj.port));

      return obj;
    }

    /**
     * Helpers.
     */

    var s$1 = 1000;
    var m$1 = s$1 * 60;
    var h$1 = m$1 * 60;
    var d$1 = h$1 * 24;
    var y$1 = d$1 * 365.25;

    /**
     * Parse or format the given `val`.
     *
     * Options:
     *
     *  - `long` verbose formatting [false]
     *
     * @param {String|Number} val
     * @param {Object} [options]
     * @throws {Error} throw an error if val is not a non-empty string or a number
     * @return {String|Number}
     * @api public
     */

    var ms$1 = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === 'string' && val.length > 0) {
        return parse$1(val);
      } else if (type === 'number' && isNaN(val) === false) {
        return options.long ? fmtLong$1(val) : fmtShort$1(val);
      }
      throw new Error(
        'val is not a non-empty string or a valid number. val=' +
          JSON.stringify(val)
      );
    };

    /**
     * Parse the given `str` and return milliseconds.
     *
     * @param {String} str
     * @return {Number}
     * @api private
     */

    function parse$1(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || 'ms').toLowerCase();
      switch (type) {
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
          return n * y$1;
        case 'days':
        case 'day':
        case 'd':
          return n * d$1;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
          return n * h$1;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
          return n * m$1;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
          return n * s$1;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
          return n;
        default:
          return undefined;
      }
    }

    /**
     * Short format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtShort$1(ms) {
      if (ms >= d$1) {
        return Math.round(ms / d$1) + 'd';
      }
      if (ms >= h$1) {
        return Math.round(ms / h$1) + 'h';
      }
      if (ms >= m$1) {
        return Math.round(ms / m$1) + 'm';
      }
      if (ms >= s$1) {
        return Math.round(ms / s$1) + 's';
      }
      return ms + 'ms';
    }

    /**
     * Long format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtLong$1(ms) {
      return plural$1(ms, d$1, 'day') ||
        plural$1(ms, h$1, 'hour') ||
        plural$1(ms, m$1, 'minute') ||
        plural$1(ms, s$1, 'second') ||
        ms + ' ms';
    }

    /**
     * Pluralization helper.
     */

    function plural$1(ms, n, name) {
      if (ms < n) {
        return;
      }
      if (ms < n * 1.5) {
        return Math.floor(ms / n) + ' ' + name;
      }
      return Math.ceil(ms / n) + ' ' + name + 's';
    }

    var debug$1 = createCommonjsModule(function (module, exports) {
    /**
     * This is the common logic for both the Node.js and web browser
     * implementations of `debug()`.
     *
     * Expose `debug()` as the module.
     */

    exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
    exports.coerce = coerce;
    exports.disable = disable;
    exports.enable = enable;
    exports.enabled = enabled;
    exports.humanize = ms$1;

    /**
     * Active `debug` instances.
     */
    exports.instances = [];

    /**
     * The currently active debug mode names, and names to skip.
     */

    exports.names = [];
    exports.skips = [];

    /**
     * Map of special "%n" handling functions, for the debug "format" argument.
     *
     * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
     */

    exports.formatters = {};

    /**
     * Select a color.
     * @param {String} namespace
     * @return {Number}
     * @api private
     */

    function selectColor(namespace) {
      var hash = 0, i;

      for (i in namespace) {
        hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }

      return exports.colors[Math.abs(hash) % exports.colors.length];
    }

    /**
     * Create a debugger with the given `namespace`.
     *
     * @param {String} namespace
     * @return {Function}
     * @api public
     */

    function createDebug(namespace) {

      var prevTime;

      function debug() {
        // disabled?
        if (!debug.enabled) return;

        var self = debug;

        // set `diff` timestamp
        var curr = +new Date();
        var ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;

        // turn the `arguments` into a proper Array
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }

        args[0] = exports.coerce(args[0]);

        if ('string' !== typeof args[0]) {
          // anything else let's inspect with %O
          args.unshift('%O');
        }

        // apply any `formatters` transformations
        var index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
          // if we encounter an escaped % then don't increase the array index
          if (match === '%%') return match;
          index++;
          var formatter = exports.formatters[format];
          if ('function' === typeof formatter) {
            var val = args[index];
            match = formatter.call(self, val);

            // now we need to remove `args[index]` since it's inlined in the `format`
            args.splice(index, 1);
            index--;
          }
          return match;
        });

        // apply env-specific formatting (colors, etc.)
        exports.formatArgs.call(self, args);

        var logFn = debug.log || exports.log || console.log.bind(console);
        logFn.apply(self, args);
      }

      debug.namespace = namespace;
      debug.enabled = exports.enabled(namespace);
      debug.useColors = exports.useColors();
      debug.color = selectColor(namespace);
      debug.destroy = destroy;

      // env-specific initialization logic for debug instances
      if ('function' === typeof exports.init) {
        exports.init(debug);
      }

      exports.instances.push(debug);

      return debug;
    }

    function destroy () {
      var index = exports.instances.indexOf(this);
      if (index !== -1) {
        exports.instances.splice(index, 1);
        return true;
      } else {
        return false;
      }
    }

    /**
     * Enables a debug mode by namespaces. This can include modes
     * separated by a colon and wildcards.
     *
     * @param {String} namespaces
     * @api public
     */

    function enable(namespaces) {
      exports.save(namespaces);

      exports.names = [];
      exports.skips = [];

      var i;
      var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
      var len = split.length;

      for (i = 0; i < len; i++) {
        if (!split[i]) continue; // ignore empty strings
        namespaces = split[i].replace(/\*/g, '.*?');
        if (namespaces[0] === '-') {
          exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
        } else {
          exports.names.push(new RegExp('^' + namespaces + '$'));
        }
      }

      for (i = 0; i < exports.instances.length; i++) {
        var instance = exports.instances[i];
        instance.enabled = exports.enabled(instance.namespace);
      }
    }

    /**
     * Disable debug output.
     *
     * @api public
     */

    function disable() {
      exports.enable('');
    }

    /**
     * Returns true if the given mode name is enabled, false otherwise.
     *
     * @param {String} name
     * @return {Boolean}
     * @api public
     */

    function enabled(name) {
      if (name[name.length - 1] === '*') {
        return true;
      }
      var i, len;
      for (i = 0, len = exports.skips.length; i < len; i++) {
        if (exports.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = exports.names.length; i < len; i++) {
        if (exports.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Coerce `val`.
     *
     * @param {Mixed} val
     * @return {Mixed}
     * @api private
     */

    function coerce(val) {
      if (val instanceof Error) return val.stack || val.message;
      return val;
    }
    });

    var browser$1 = createCommonjsModule(function (module, exports) {
    /**
     * This is the web browser implementation of `debug()`.
     *
     * Expose `debug()` as the module.
     */

    exports = module.exports = debug$1;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = 'undefined' != typeof chrome
                   && 'undefined' != typeof chrome.storage
                      ? chrome.storage.local
                      : localstorage();

    /**
     * Colors.
     */

    exports.colors = [
      '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
      '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
      '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
      '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
      '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
      '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
      '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
      '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
      '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
      '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
      '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
    ];

    /**
     * Currently only WebKit-based Web Inspectors, Firefox >= v31,
     * and the Firebug extension (any Firefox version) are known
     * to support "%c" CSS customizations.
     *
     * TODO: add a `localStorage` variable to explicitly enable/disable colors
     */

    function useColors() {
      // NB: In an Electron preload script, document will be defined but not fully
      // initialized. Since we know we're in Chrome, we'll just detect this case
      // explicitly
      if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
        return true;
      }

      // Internet Explorer and Edge do not support colors.
      if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }

      // is webkit? http://stackoverflow.com/a/16459606/376773
      // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
      return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
        // is firebug? http://stackoverflow.com/a/398120/376773
        (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
        // is firefox >= v31?
        // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
        (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
        // double check webkit in userAgent just in case we are in a worker
        (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
    }

    /**
     * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
     */

    exports.formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (err) {
        return '[UnexpectedJSONParseError]: ' + err.message;
      }
    };


    /**
     * Colorize log arguments if enabled.
     *
     * @api public
     */

    function formatArgs(args) {
      var useColors = this.useColors;

      args[0] = (useColors ? '%c' : '')
        + this.namespace
        + (useColors ? ' %c' : ' ')
        + args[0]
        + (useColors ? '%c ' : ' ')
        + '+' + exports.humanize(this.diff);

      if (!useColors) return;

      var c = 'color: ' + this.color;
      args.splice(1, 0, c, 'color: inherit');

      // the final "%c" is somewhat tricky, because there could be other
      // arguments passed either before or after the %c, so we need to
      // figure out the correct index to insert the CSS into
      var index = 0;
      var lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, function(match) {
        if ('%%' === match) return;
        index++;
        if ('%c' === match) {
          // we only are interested in the *last* %c
          // (the user may have provided their own)
          lastC = index;
        }
      });

      args.splice(lastC, 0, c);
    }

    /**
     * Invokes `console.log()` when available.
     * No-op when `console.log` is not a "function".
     *
     * @api public
     */

    function log() {
      // this hackery is required for IE8/9, where
      // the `console.log` function doesn't have 'apply'
      return 'object' === typeof console
        && console.log
        && Function.prototype.apply.call(console.log, console, arguments);
    }

    /**
     * Save `namespaces`.
     *
     * @param {String} namespaces
     * @api private
     */

    function save(namespaces) {
      try {
        if (null == namespaces) {
          exports.storage.removeItem('debug');
        } else {
          exports.storage.debug = namespaces;
        }
      } catch(e) {}
    }

    /**
     * Load `namespaces`.
     *
     * @return {String} returns the previously persisted debug modes
     * @api private
     */

    function load() {
      var r;
      try {
        r = exports.storage.debug;
      } catch(e) {}

      // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
      if (!r && typeof process !== 'undefined' && 'env' in process) {
        r = process.env.DEBUG;
      }

      return r;
    }

    /**
     * Enable namespaces listed in `localStorage.debug` initially.
     */

    exports.enable(load());

    /**
     * Localstorage attempts to return the localstorage.
     *
     * This is necessary because safari throws
     * when a user disables cookies/localstorage
     * and you attempt to access it.
     *
     * @return {LocalStorage}
     * @api private
     */

    function localstorage() {
      try {
        return window.localStorage;
      } catch (e) {}
    }
    });

    var componentEmitter = createCommonjsModule(function (module) {
    /**
     * Expose `Emitter`.
     */

    {
      module.exports = Emitter;
    }

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter(obj) {
      if (obj) return mixin(obj);
    }
    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin(obj) {
      for (var key in Emitter.prototype) {
        obj[key] = Emitter.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.on =
    Emitter.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.off =
    Emitter.prototype.removeListener =
    Emitter.prototype.removeAllListeners =
    Emitter.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }

      // Remove event specific arrays for event types that no
      // one is subscribed for to avoid memory leak.
      if (callbacks.length === 0) {
        delete this._callbacks['$' + event];
      }

      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};

      var args = new Array(arguments.length - 1)
        , callbacks = this._callbacks['$' + event];

      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };
    });

    var toString = {}.toString;

    var isarray = Array.isArray || function (arr) {
      return toString.call(arr) == '[object Array]';
    };

    var isBuffer = isBuf;

    var withNativeBuffer = typeof Buffer === 'function' && typeof Buffer.isBuffer === 'function';
    var withNativeArrayBuffer = typeof ArrayBuffer === 'function';

    var isView = function (obj) {
      return typeof ArrayBuffer.isView === 'function' ? ArrayBuffer.isView(obj) : (obj.buffer instanceof ArrayBuffer);
    };

    /**
     * Returns true if obj is a buffer or an arraybuffer.
     *
     * @api private
     */

    function isBuf(obj) {
      return (withNativeBuffer && Buffer.isBuffer(obj)) ||
              (withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj)));
    }

    /*global Blob,File*/

    /**
     * Module requirements
     */



    var toString$1 = Object.prototype.toString;
    var withNativeBlob = typeof Blob === 'function' || (typeof Blob !== 'undefined' && toString$1.call(Blob) === '[object BlobConstructor]');
    var withNativeFile = typeof File === 'function' || (typeof File !== 'undefined' && toString$1.call(File) === '[object FileConstructor]');

    /**
     * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
     * Anything with blobs or files should be fed through removeBlobs before coming
     * here.
     *
     * @param {Object} packet - socket.io event packet
     * @return {Object} with deconstructed packet and list of buffers
     * @api public
     */

    var deconstructPacket = function(packet) {
      var buffers = [];
      var packetData = packet.data;
      var pack = packet;
      pack.data = _deconstructPacket(packetData, buffers);
      pack.attachments = buffers.length; // number of binary 'attachments'
      return {packet: pack, buffers: buffers};
    };

    function _deconstructPacket(data, buffers) {
      if (!data) return data;

      if (isBuffer(data)) {
        var placeholder = { _placeholder: true, num: buffers.length };
        buffers.push(data);
        return placeholder;
      } else if (isarray(data)) {
        var newData = new Array(data.length);
        for (var i = 0; i < data.length; i++) {
          newData[i] = _deconstructPacket(data[i], buffers);
        }
        return newData;
      } else if (typeof data === 'object' && !(data instanceof Date)) {
        var newData = {};
        for (var key in data) {
          newData[key] = _deconstructPacket(data[key], buffers);
        }
        return newData;
      }
      return data;
    }

    /**
     * Reconstructs a binary packet from its placeholder packet and buffers
     *
     * @param {Object} packet - event packet with placeholders
     * @param {Array} buffers - binary buffers to put in placeholder positions
     * @return {Object} reconstructed packet
     * @api public
     */

    var reconstructPacket = function(packet, buffers) {
      packet.data = _reconstructPacket(packet.data, buffers);
      packet.attachments = undefined; // no longer useful
      return packet;
    };

    function _reconstructPacket(data, buffers) {
      if (!data) return data;

      if (data && data._placeholder) {
        return buffers[data.num]; // appropriate buffer (should be natural order anyway)
      } else if (isarray(data)) {
        for (var i = 0; i < data.length; i++) {
          data[i] = _reconstructPacket(data[i], buffers);
        }
      } else if (typeof data === 'object') {
        for (var key in data) {
          data[key] = _reconstructPacket(data[key], buffers);
        }
      }

      return data;
    }

    /**
     * Asynchronously removes Blobs or Files from data via
     * FileReader's readAsArrayBuffer method. Used before encoding
     * data as msgpack. Calls callback with the blobless data.
     *
     * @param {Object} data
     * @param {Function} callback
     * @api private
     */

    var removeBlobs = function(data, callback) {
      function _removeBlobs(obj, curKey, containingObject) {
        if (!obj) return obj;

        // convert any blob
        if ((withNativeBlob && obj instanceof Blob) ||
            (withNativeFile && obj instanceof File)) {
          pendingBlobs++;

          // async filereader
          var fileReader = new FileReader();
          fileReader.onload = function() { // this.result == arraybuffer
            if (containingObject) {
              containingObject[curKey] = this.result;
            }
            else {
              bloblessData = this.result;
            }

            // if nothing pending its callback time
            if(! --pendingBlobs) {
              callback(bloblessData);
            }
          };

          fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
        } else if (isarray(obj)) { // handle array
          for (var i = 0; i < obj.length; i++) {
            _removeBlobs(obj[i], i, obj);
          }
        } else if (typeof obj === 'object' && !isBuffer(obj)) { // and object
          for (var key in obj) {
            _removeBlobs(obj[key], key, obj);
          }
        }
      }

      var pendingBlobs = 0;
      var bloblessData = data;
      _removeBlobs(bloblessData);
      if (!pendingBlobs) {
        callback(bloblessData);
      }
    };

    var binary = {
    	deconstructPacket: deconstructPacket,
    	reconstructPacket: reconstructPacket,
    	removeBlobs: removeBlobs
    };

    var socket_ioParser = createCommonjsModule(function (module, exports) {
    /**
     * Module dependencies.
     */

    var debug = browser$1('socket.io-parser');





    /**
     * Protocol version.
     *
     * @api public
     */

    exports.protocol = 4;

    /**
     * Packet types.
     *
     * @api public
     */

    exports.types = [
      'CONNECT',
      'DISCONNECT',
      'EVENT',
      'ACK',
      'ERROR',
      'BINARY_EVENT',
      'BINARY_ACK'
    ];

    /**
     * Packet type `connect`.
     *
     * @api public
     */

    exports.CONNECT = 0;

    /**
     * Packet type `disconnect`.
     *
     * @api public
     */

    exports.DISCONNECT = 1;

    /**
     * Packet type `event`.
     *
     * @api public
     */

    exports.EVENT = 2;

    /**
     * Packet type `ack`.
     *
     * @api public
     */

    exports.ACK = 3;

    /**
     * Packet type `error`.
     *
     * @api public
     */

    exports.ERROR = 4;

    /**
     * Packet type 'binary event'
     *
     * @api public
     */

    exports.BINARY_EVENT = 5;

    /**
     * Packet type `binary ack`. For acks with binary arguments.
     *
     * @api public
     */

    exports.BINARY_ACK = 6;

    /**
     * Encoder constructor.
     *
     * @api public
     */

    exports.Encoder = Encoder;

    /**
     * Decoder constructor.
     *
     * @api public
     */

    exports.Decoder = Decoder;

    /**
     * A socket.io Encoder instance
     *
     * @api public
     */

    function Encoder() {}

    var ERROR_PACKET = exports.ERROR + '"encode error"';

    /**
     * Encode a packet as a single string if non-binary, or as a
     * buffer sequence, depending on packet type.
     *
     * @param {Object} obj - packet object
     * @param {Function} callback - function to handle encodings (likely engine.write)
     * @return Calls callback with Array of encodings
     * @api public
     */

    Encoder.prototype.encode = function(obj, callback){
      debug('encoding packet %j', obj);

      if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
        encodeAsBinary(obj, callback);
      } else {
        var encoding = encodeAsString(obj);
        callback([encoding]);
      }
    };

    /**
     * Encode packet as string.
     *
     * @param {Object} packet
     * @return {String} encoded
     * @api private
     */

    function encodeAsString(obj) {

      // first is type
      var str = '' + obj.type;

      // attachments if we have them
      if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
        str += obj.attachments + '-';
      }

      // if we have a namespace other than `/`
      // we append it followed by a comma `,`
      if (obj.nsp && '/' !== obj.nsp) {
        str += obj.nsp + ',';
      }

      // immediately followed by the id
      if (null != obj.id) {
        str += obj.id;
      }

      // json data
      if (null != obj.data) {
        var payload = tryStringify(obj.data);
        if (payload !== false) {
          str += payload;
        } else {
          return ERROR_PACKET;
        }
      }

      debug('encoded %j as %s', obj, str);
      return str;
    }

    function tryStringify(str) {
      try {
        return JSON.stringify(str);
      } catch(e){
        return false;
      }
    }

    /**
     * Encode packet as 'buffer sequence' by removing blobs, and
     * deconstructing packet into object with placeholders and
     * a list of buffers.
     *
     * @param {Object} packet
     * @return {Buffer} encoded
     * @api private
     */

    function encodeAsBinary(obj, callback) {

      function writeEncoding(bloblessData) {
        var deconstruction = binary.deconstructPacket(bloblessData);
        var pack = encodeAsString(deconstruction.packet);
        var buffers = deconstruction.buffers;

        buffers.unshift(pack); // add packet info to beginning of data list
        callback(buffers); // write all the buffers
      }

      binary.removeBlobs(obj, writeEncoding);
    }

    /**
     * A socket.io Decoder instance
     *
     * @return {Object} decoder
     * @api public
     */

    function Decoder() {
      this.reconstructor = null;
    }

    /**
     * Mix in `Emitter` with Decoder.
     */

    componentEmitter(Decoder.prototype);

    /**
     * Decodes an encoded packet string into packet JSON.
     *
     * @param {String} obj - encoded packet
     * @return {Object} packet
     * @api public
     */

    Decoder.prototype.add = function(obj) {
      var packet;
      if (typeof obj === 'string') {
        packet = decodeString(obj);
        if (exports.BINARY_EVENT === packet.type || exports.BINARY_ACK === packet.type) { // binary packet's json
          this.reconstructor = new BinaryReconstructor(packet);

          // no attachments, labeled binary but no binary data to follow
          if (this.reconstructor.reconPack.attachments === 0) {
            this.emit('decoded', packet);
          }
        } else { // non-binary full packet
          this.emit('decoded', packet);
        }
      } else if (isBuffer(obj) || obj.base64) { // raw binary data
        if (!this.reconstructor) {
          throw new Error('got binary data when not reconstructing a packet');
        } else {
          packet = this.reconstructor.takeBinaryData(obj);
          if (packet) { // received final buffer
            this.reconstructor = null;
            this.emit('decoded', packet);
          }
        }
      } else {
        throw new Error('Unknown type: ' + obj);
      }
    };

    /**
     * Decode a packet String (JSON data)
     *
     * @param {String} str
     * @return {Object} packet
     * @api private
     */

    function decodeString(str) {
      var i = 0;
      // look up type
      var p = {
        type: Number(str.charAt(0))
      };

      if (null == exports.types[p.type]) {
        return error('unknown packet type ' + p.type);
      }

      // look up attachments if type binary
      if (exports.BINARY_EVENT === p.type || exports.BINARY_ACK === p.type) {
        var buf = '';
        while (str.charAt(++i) !== '-') {
          buf += str.charAt(i);
          if (i == str.length) break;
        }
        if (buf != Number(buf) || str.charAt(i) !== '-') {
          throw new Error('Illegal attachments');
        }
        p.attachments = Number(buf);
      }

      // look up namespace (if any)
      if ('/' === str.charAt(i + 1)) {
        p.nsp = '';
        while (++i) {
          var c = str.charAt(i);
          if (',' === c) break;
          p.nsp += c;
          if (i === str.length) break;
        }
      } else {
        p.nsp = '/';
      }

      // look up id
      var next = str.charAt(i + 1);
      if ('' !== next && Number(next) == next) {
        p.id = '';
        while (++i) {
          var c = str.charAt(i);
          if (null == c || Number(c) != c) {
            --i;
            break;
          }
          p.id += str.charAt(i);
          if (i === str.length) break;
        }
        p.id = Number(p.id);
      }

      // look up json data
      if (str.charAt(++i)) {
        var payload = tryParse(str.substr(i));
        var isPayloadValid = payload !== false && (p.type === exports.ERROR || isarray(payload));
        if (isPayloadValid) {
          p.data = payload;
        } else {
          return error('invalid payload');
        }
      }

      debug('decoded %s as %j', str, p);
      return p;
    }

    function tryParse(str) {
      try {
        return JSON.parse(str);
      } catch(e){
        return false;
      }
    }

    /**
     * Deallocates a parser's resources
     *
     * @api public
     */

    Decoder.prototype.destroy = function() {
      if (this.reconstructor) {
        this.reconstructor.finishedReconstruction();
      }
    };

    /**
     * A manager of a binary event's 'buffer sequence'. Should
     * be constructed whenever a packet of type BINARY_EVENT is
     * decoded.
     *
     * @param {Object} packet
     * @return {BinaryReconstructor} initialized reconstructor
     * @api private
     */

    function BinaryReconstructor(packet) {
      this.reconPack = packet;
      this.buffers = [];
    }

    /**
     * Method to be called when binary data received from connection
     * after a BINARY_EVENT packet.
     *
     * @param {Buffer | ArrayBuffer} binData - the raw binary data received
     * @return {null | Object} returns null if more binary data is expected or
     *   a reconstructed packet object if all buffers have been received.
     * @api private
     */

    BinaryReconstructor.prototype.takeBinaryData = function(binData) {
      this.buffers.push(binData);
      if (this.buffers.length === this.reconPack.attachments) { // done with buffer list
        var packet = binary.reconstructPacket(this.reconPack, this.buffers);
        this.finishedReconstruction();
        return packet;
      }
      return null;
    };

    /**
     * Cleans up binary packet reconstruction variables.
     *
     * @api private
     */

    BinaryReconstructor.prototype.finishedReconstruction = function() {
      this.reconPack = null;
      this.buffers = [];
    };

    function error(msg) {
      return {
        type: exports.ERROR,
        data: 'parser error: ' + msg
      };
    }
    });

    var hasCors = createCommonjsModule(function (module) {
    /**
     * Module exports.
     *
     * Logic borrowed from Modernizr:
     *
     *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
     */

    try {
      module.exports = typeof XMLHttpRequest !== 'undefined' &&
        'withCredentials' in new XMLHttpRequest();
    } catch (err) {
      // if XMLHttp support is disabled in IE then it will throw
      // when trying to create
      module.exports = false;
    }
    });

    var globalThis_browser = (function () {
      if (typeof self !== 'undefined') {
        return self;
      } else if (typeof window !== 'undefined') {
        return window;
      } else {
        return Function('return this')(); // eslint-disable-line no-new-func
      }
    })();

    // browser shim for xmlhttprequest module




    var xmlhttprequest = function (opts) {
      var xdomain = opts.xdomain;

      // scheme must be same when usign XDomainRequest
      // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
      var xscheme = opts.xscheme;

      // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
      // https://github.com/Automattic/engine.io-client/pull/217
      var enablesXDR = opts.enablesXDR;

      // XMLHttpRequest can be disabled on IE
      try {
        if ('undefined' !== typeof XMLHttpRequest && (!xdomain || hasCors)) {
          return new XMLHttpRequest();
        }
      } catch (e) { }

      // Use XDomainRequest for IE8 if enablesXDR is true
      // because loading bar keeps flashing when using jsonp-polling
      // https://github.com/yujiosaka/socke.io-ie8-loading-example
      try {
        if ('undefined' !== typeof XDomainRequest && !xscheme && enablesXDR) {
          return new XDomainRequest();
        }
      } catch (e) { }

      if (!xdomain) {
        try {
          return new globalThis_browser[['Active'].concat('Object').join('X')]('Microsoft.XMLHTTP');
        } catch (e) { }
      }
    };

    /**
     * Gets the keys for an object.
     *
     * @return {Array} keys
     * @api private
     */

    var keys = Object.keys || function keys (obj){
      var arr = [];
      var has = Object.prototype.hasOwnProperty;

      for (var i in obj) {
        if (has.call(obj, i)) {
          arr.push(i);
        }
      }
      return arr;
    };

    /* global Blob File */

    /*
     * Module requirements.
     */



    var toString$2 = Object.prototype.toString;
    var withNativeBlob$1 = typeof Blob === 'function' ||
                            typeof Blob !== 'undefined' && toString$2.call(Blob) === '[object BlobConstructor]';
    var withNativeFile$1 = typeof File === 'function' ||
                            typeof File !== 'undefined' && toString$2.call(File) === '[object FileConstructor]';

    /**
     * Module exports.
     */

    var hasBinary2 = hasBinary;

    /**
     * Checks for binary data.
     *
     * Supports Buffer, ArrayBuffer, Blob and File.
     *
     * @param {Object} anything
     * @api public
     */

    function hasBinary (obj) {
      if (!obj || typeof obj !== 'object') {
        return false;
      }

      if (isarray(obj)) {
        for (var i = 0, l = obj.length; i < l; i++) {
          if (hasBinary(obj[i])) {
            return true;
          }
        }
        return false;
      }

      if ((typeof Buffer === 'function' && Buffer.isBuffer && Buffer.isBuffer(obj)) ||
        (typeof ArrayBuffer === 'function' && obj instanceof ArrayBuffer) ||
        (withNativeBlob$1 && obj instanceof Blob) ||
        (withNativeFile$1 && obj instanceof File)
      ) {
        return true;
      }

      // see: https://github.com/Automattic/has-binary/pull/4
      if (obj.toJSON && typeof obj.toJSON === 'function' && arguments.length === 1) {
        return hasBinary(obj.toJSON(), true);
      }

      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
          return true;
        }
      }

      return false;
    }

    /**
     * An abstraction for slicing an arraybuffer even when
     * ArrayBuffer.prototype.slice is not supported
     *
     * @api public
     */

    var arraybuffer_slice = function(arraybuffer, start, end) {
      var bytes = arraybuffer.byteLength;
      start = start || 0;
      end = end || bytes;

      if (arraybuffer.slice) { return arraybuffer.slice(start, end); }

      if (start < 0) { start += bytes; }
      if (end < 0) { end += bytes; }
      if (end > bytes) { end = bytes; }

      if (start >= bytes || start >= end || bytes === 0) {
        return new ArrayBuffer(0);
      }

      var abv = new Uint8Array(arraybuffer);
      var result = new Uint8Array(end - start);
      for (var i = start, ii = 0; i < end; i++, ii++) {
        result[ii] = abv[i];
      }
      return result.buffer;
    };

    var after_1 = after;

    function after(count, callback, err_cb) {
        var bail = false;
        err_cb = err_cb || noop$1;
        proxy.count = count;

        return (count === 0) ? callback() : proxy

        function proxy(err, result) {
            if (proxy.count <= 0) {
                throw new Error('after called too many times')
            }
            --proxy.count;

            // after first error, rest are passed to err_cb
            if (err) {
                bail = true;
                callback(err);
                // future error callbacks will go to error handler
                callback = err_cb;
            } else if (proxy.count === 0 && !bail) {
                callback(null, result);
            }
        }
    }

    function noop$1() {}

    /*! https://mths.be/utf8js v2.1.2 by @mathias */

    var stringFromCharCode = String.fromCharCode;

    // Taken from https://mths.be/punycode
    function ucs2decode(string) {
    	var output = [];
    	var counter = 0;
    	var length = string.length;
    	var value;
    	var extra;
    	while (counter < length) {
    		value = string.charCodeAt(counter++);
    		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
    			// high surrogate, and there is a next character
    			extra = string.charCodeAt(counter++);
    			if ((extra & 0xFC00) == 0xDC00) { // low surrogate
    				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
    			} else {
    				// unmatched surrogate; only append this code unit, in case the next
    				// code unit is the high surrogate of a surrogate pair
    				output.push(value);
    				counter--;
    			}
    		} else {
    			output.push(value);
    		}
    	}
    	return output;
    }

    // Taken from https://mths.be/punycode
    function ucs2encode(array) {
    	var length = array.length;
    	var index = -1;
    	var value;
    	var output = '';
    	while (++index < length) {
    		value = array[index];
    		if (value > 0xFFFF) {
    			value -= 0x10000;
    			output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
    			value = 0xDC00 | value & 0x3FF;
    		}
    		output += stringFromCharCode(value);
    	}
    	return output;
    }

    function checkScalarValue(codePoint, strict) {
    	if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
    		if (strict) {
    			throw Error(
    				'Lone surrogate U+' + codePoint.toString(16).toUpperCase() +
    				' is not a scalar value'
    			);
    		}
    		return false;
    	}
    	return true;
    }
    /*--------------------------------------------------------------------------*/

    function createByte(codePoint, shift) {
    	return stringFromCharCode(((codePoint >> shift) & 0x3F) | 0x80);
    }

    function encodeCodePoint(codePoint, strict) {
    	if ((codePoint & 0xFFFFFF80) == 0) { // 1-byte sequence
    		return stringFromCharCode(codePoint);
    	}
    	var symbol = '';
    	if ((codePoint & 0xFFFFF800) == 0) { // 2-byte sequence
    		symbol = stringFromCharCode(((codePoint >> 6) & 0x1F) | 0xC0);
    	}
    	else if ((codePoint & 0xFFFF0000) == 0) { // 3-byte sequence
    		if (!checkScalarValue(codePoint, strict)) {
    			codePoint = 0xFFFD;
    		}
    		symbol = stringFromCharCode(((codePoint >> 12) & 0x0F) | 0xE0);
    		symbol += createByte(codePoint, 6);
    	}
    	else if ((codePoint & 0xFFE00000) == 0) { // 4-byte sequence
    		symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xF0);
    		symbol += createByte(codePoint, 12);
    		symbol += createByte(codePoint, 6);
    	}
    	symbol += stringFromCharCode((codePoint & 0x3F) | 0x80);
    	return symbol;
    }

    function utf8encode(string, opts) {
    	opts = opts || {};
    	var strict = false !== opts.strict;

    	var codePoints = ucs2decode(string);
    	var length = codePoints.length;
    	var index = -1;
    	var codePoint;
    	var byteString = '';
    	while (++index < length) {
    		codePoint = codePoints[index];
    		byteString += encodeCodePoint(codePoint, strict);
    	}
    	return byteString;
    }

    /*--------------------------------------------------------------------------*/

    function readContinuationByte() {
    	if (byteIndex >= byteCount) {
    		throw Error('Invalid byte index');
    	}

    	var continuationByte = byteArray[byteIndex] & 0xFF;
    	byteIndex++;

    	if ((continuationByte & 0xC0) == 0x80) {
    		return continuationByte & 0x3F;
    	}

    	// If we end up here, it’s not a continuation byte
    	throw Error('Invalid continuation byte');
    }

    function decodeSymbol(strict) {
    	var byte1;
    	var byte2;
    	var byte3;
    	var byte4;
    	var codePoint;

    	if (byteIndex > byteCount) {
    		throw Error('Invalid byte index');
    	}

    	if (byteIndex == byteCount) {
    		return false;
    	}

    	// Read first byte
    	byte1 = byteArray[byteIndex] & 0xFF;
    	byteIndex++;

    	// 1-byte sequence (no continuation bytes)
    	if ((byte1 & 0x80) == 0) {
    		return byte1;
    	}

    	// 2-byte sequence
    	if ((byte1 & 0xE0) == 0xC0) {
    		byte2 = readContinuationByte();
    		codePoint = ((byte1 & 0x1F) << 6) | byte2;
    		if (codePoint >= 0x80) {
    			return codePoint;
    		} else {
    			throw Error('Invalid continuation byte');
    		}
    	}

    	// 3-byte sequence (may include unpaired surrogates)
    	if ((byte1 & 0xF0) == 0xE0) {
    		byte2 = readContinuationByte();
    		byte3 = readContinuationByte();
    		codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
    		if (codePoint >= 0x0800) {
    			return checkScalarValue(codePoint, strict) ? codePoint : 0xFFFD;
    		} else {
    			throw Error('Invalid continuation byte');
    		}
    	}

    	// 4-byte sequence
    	if ((byte1 & 0xF8) == 0xF0) {
    		byte2 = readContinuationByte();
    		byte3 = readContinuationByte();
    		byte4 = readContinuationByte();
    		codePoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0C) |
    			(byte3 << 0x06) | byte4;
    		if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
    			return codePoint;
    		}
    	}

    	throw Error('Invalid UTF-8 detected');
    }

    var byteArray;
    var byteCount;
    var byteIndex;
    function utf8decode(byteString, opts) {
    	opts = opts || {};
    	var strict = false !== opts.strict;

    	byteArray = ucs2decode(byteString);
    	byteCount = byteArray.length;
    	byteIndex = 0;
    	var codePoints = [];
    	var tmp;
    	while ((tmp = decodeSymbol(strict)) !== false) {
    		codePoints.push(tmp);
    	}
    	return ucs2encode(codePoints);
    }

    var utf8 = {
    	version: '2.1.2',
    	encode: utf8encode,
    	decode: utf8decode
    };

    var base64Arraybuffer = createCommonjsModule(function (module, exports) {
    /*
     * base64-arraybuffer
     * https://github.com/niklasvh/base64-arraybuffer
     *
     * Copyright (c) 2012 Niklas von Hertzen
     * Licensed under the MIT license.
     */
    (function(chars){

      exports.encode = function(arraybuffer) {
        var bytes = new Uint8Array(arraybuffer),
        i, len = bytes.length, base64 = "";

        for (i = 0; i < len; i+=3) {
          base64 += chars[bytes[i] >> 2];
          base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
          base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
          base64 += chars[bytes[i + 2] & 63];
        }

        if ((len % 3) === 2) {
          base64 = base64.substring(0, base64.length - 1) + "=";
        } else if (len % 3 === 1) {
          base64 = base64.substring(0, base64.length - 2) + "==";
        }

        return base64;
      };

      exports.decode =  function(base64) {
        var bufferLength = base64.length * 0.75,
        len = base64.length, i, p = 0,
        encoded1, encoded2, encoded3, encoded4;

        if (base64[base64.length - 1] === "=") {
          bufferLength--;
          if (base64[base64.length - 2] === "=") {
            bufferLength--;
          }
        }

        var arraybuffer = new ArrayBuffer(bufferLength),
        bytes = new Uint8Array(arraybuffer);

        for (i = 0; i < len; i+=4) {
          encoded1 = chars.indexOf(base64[i]);
          encoded2 = chars.indexOf(base64[i+1]);
          encoded3 = chars.indexOf(base64[i+2]);
          encoded4 = chars.indexOf(base64[i+3]);

          bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
          bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
          bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }

        return arraybuffer;
      };
    })("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
    });

    /**
     * Create a blob builder even when vendor prefixes exist
     */

    var BlobBuilder = typeof BlobBuilder !== 'undefined' ? BlobBuilder :
      typeof WebKitBlobBuilder !== 'undefined' ? WebKitBlobBuilder :
      typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder :
      typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder : 
      false;

    /**
     * Check if Blob constructor is supported
     */

    var blobSupported = (function() {
      try {
        var a = new Blob(['hi']);
        return a.size === 2;
      } catch(e) {
        return false;
      }
    })();

    /**
     * Check if Blob constructor supports ArrayBufferViews
     * Fails in Safari 6, so we need to map to ArrayBuffers there.
     */

    var blobSupportsArrayBufferView = blobSupported && (function() {
      try {
        var b = new Blob([new Uint8Array([1,2])]);
        return b.size === 2;
      } catch(e) {
        return false;
      }
    })();

    /**
     * Check if BlobBuilder is supported
     */

    var blobBuilderSupported = BlobBuilder
      && BlobBuilder.prototype.append
      && BlobBuilder.prototype.getBlob;

    /**
     * Helper function that maps ArrayBufferViews to ArrayBuffers
     * Used by BlobBuilder constructor and old browsers that didn't
     * support it in the Blob constructor.
     */

    function mapArrayBufferViews(ary) {
      return ary.map(function(chunk) {
        if (chunk.buffer instanceof ArrayBuffer) {
          var buf = chunk.buffer;

          // if this is a subarray, make a copy so we only
          // include the subarray region from the underlying buffer
          if (chunk.byteLength !== buf.byteLength) {
            var copy = new Uint8Array(chunk.byteLength);
            copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
            buf = copy.buffer;
          }

          return buf;
        }

        return chunk;
      });
    }

    function BlobBuilderConstructor(ary, options) {
      options = options || {};

      var bb = new BlobBuilder();
      mapArrayBufferViews(ary).forEach(function(part) {
        bb.append(part);
      });

      return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
    }
    function BlobConstructor(ary, options) {
      return new Blob(mapArrayBufferViews(ary), options || {});
    }
    if (typeof Blob !== 'undefined') {
      BlobBuilderConstructor.prototype = Blob.prototype;
      BlobConstructor.prototype = Blob.prototype;
    }

    var blob = (function() {
      if (blobSupported) {
        return blobSupportsArrayBufferView ? Blob : BlobConstructor;
      } else if (blobBuilderSupported) {
        return BlobBuilderConstructor;
      } else {
        return undefined;
      }
    })();

    var browser$2 = createCommonjsModule(function (module, exports) {
    /**
     * Module dependencies.
     */







    var base64encoder;
    if (typeof ArrayBuffer !== 'undefined') {
      base64encoder = base64Arraybuffer;
    }

    /**
     * Check if we are running an android browser. That requires us to use
     * ArrayBuffer with polling transports...
     *
     * http://ghinda.net/jpeg-blob-ajax-android/
     */

    var isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    /**
     * Check if we are running in PhantomJS.
     * Uploading a Blob with PhantomJS does not work correctly, as reported here:
     * https://github.com/ariya/phantomjs/issues/11395
     * @type boolean
     */
    var isPhantomJS = typeof navigator !== 'undefined' && /PhantomJS/i.test(navigator.userAgent);

    /**
     * When true, avoids using Blobs to encode payloads.
     * @type boolean
     */
    var dontSendBlobs = isAndroid || isPhantomJS;

    /**
     * Current protocol version.
     */

    exports.protocol = 3;

    /**
     * Packet types.
     */

    var packets = exports.packets = {
        open:     0    // non-ws
      , close:    1    // non-ws
      , ping:     2
      , pong:     3
      , message:  4
      , upgrade:  5
      , noop:     6
    };

    var packetslist = keys(packets);

    /**
     * Premade error packet.
     */

    var err = { type: 'error', data: 'parser error' };

    /**
     * Create a blob api even for blob builder when vendor prefixes exist
     */



    /**
     * Encodes a packet.
     *
     *     <packet type id> [ <data> ]
     *
     * Example:
     *
     *     5hello world
     *     3
     *     4
     *
     * Binary is encoded in an identical principle
     *
     * @api private
     */

    exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
      if (typeof supportsBinary === 'function') {
        callback = supportsBinary;
        supportsBinary = false;
      }

      if (typeof utf8encode === 'function') {
        callback = utf8encode;
        utf8encode = null;
      }

      var data = (packet.data === undefined)
        ? undefined
        : packet.data.buffer || packet.data;

      if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
        return encodeArrayBuffer(packet, supportsBinary, callback);
      } else if (typeof blob !== 'undefined' && data instanceof blob) {
        return encodeBlob(packet, supportsBinary, callback);
      }

      // might be an object with { base64: true, data: dataAsBase64String }
      if (data && data.base64) {
        return encodeBase64Object(packet, callback);
      }

      // Sending data as a utf-8 string
      var encoded = packets[packet.type];

      // data fragment is optional
      if (undefined !== packet.data) {
        encoded += utf8encode ? utf8.encode(String(packet.data), { strict: false }) : String(packet.data);
      }

      return callback('' + encoded);

    };

    function encodeBase64Object(packet, callback) {
      // packet data is an object { base64: true, data: dataAsBase64String }
      var message = 'b' + exports.packets[packet.type] + packet.data.data;
      return callback(message);
    }

    /**
     * Encode packet helpers for binary types
     */

    function encodeArrayBuffer(packet, supportsBinary, callback) {
      if (!supportsBinary) {
        return exports.encodeBase64Packet(packet, callback);
      }

      var data = packet.data;
      var contentArray = new Uint8Array(data);
      var resultBuffer = new Uint8Array(1 + data.byteLength);

      resultBuffer[0] = packets[packet.type];
      for (var i = 0; i < contentArray.length; i++) {
        resultBuffer[i+1] = contentArray[i];
      }

      return callback(resultBuffer.buffer);
    }

    function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
      if (!supportsBinary) {
        return exports.encodeBase64Packet(packet, callback);
      }

      var fr = new FileReader();
      fr.onload = function() {
        exports.encodePacket({ type: packet.type, data: fr.result }, supportsBinary, true, callback);
      };
      return fr.readAsArrayBuffer(packet.data);
    }

    function encodeBlob(packet, supportsBinary, callback) {
      if (!supportsBinary) {
        return exports.encodeBase64Packet(packet, callback);
      }

      if (dontSendBlobs) {
        return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
      }

      var length = new Uint8Array(1);
      length[0] = packets[packet.type];
      var blob$1 = new blob([length.buffer, packet.data]);

      return callback(blob$1);
    }

    /**
     * Encodes a packet with binary data in a base64 string
     *
     * @param {Object} packet, has `type` and `data`
     * @return {String} base64 encoded message
     */

    exports.encodeBase64Packet = function(packet, callback) {
      var message = 'b' + exports.packets[packet.type];
      if (typeof blob !== 'undefined' && packet.data instanceof blob) {
        var fr = new FileReader();
        fr.onload = function() {
          var b64 = fr.result.split(',')[1];
          callback(message + b64);
        };
        return fr.readAsDataURL(packet.data);
      }

      var b64data;
      try {
        b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
      } catch (e) {
        // iPhone Safari doesn't let you apply with typed arrays
        var typed = new Uint8Array(packet.data);
        var basic = new Array(typed.length);
        for (var i = 0; i < typed.length; i++) {
          basic[i] = typed[i];
        }
        b64data = String.fromCharCode.apply(null, basic);
      }
      message += btoa(b64data);
      return callback(message);
    };

    /**
     * Decodes a packet. Changes format to Blob if requested.
     *
     * @return {Object} with `type` and `data` (if any)
     * @api private
     */

    exports.decodePacket = function (data, binaryType, utf8decode) {
      if (data === undefined) {
        return err;
      }
      // String data
      if (typeof data === 'string') {
        if (data.charAt(0) === 'b') {
          return exports.decodeBase64Packet(data.substr(1), binaryType);
        }

        if (utf8decode) {
          data = tryDecode(data);
          if (data === false) {
            return err;
          }
        }
        var type = data.charAt(0);

        if (Number(type) != type || !packetslist[type]) {
          return err;
        }

        if (data.length > 1) {
          return { type: packetslist[type], data: data.substring(1) };
        } else {
          return { type: packetslist[type] };
        }
      }

      var asArray = new Uint8Array(data);
      var type = asArray[0];
      var rest = arraybuffer_slice(data, 1);
      if (blob && binaryType === 'blob') {
        rest = new blob([rest]);
      }
      return { type: packetslist[type], data: rest };
    };

    function tryDecode(data) {
      try {
        data = utf8.decode(data, { strict: false });
      } catch (e) {
        return false;
      }
      return data;
    }

    /**
     * Decodes a packet encoded in a base64 string
     *
     * @param {String} base64 encoded message
     * @return {Object} with `type` and `data` (if any)
     */

    exports.decodeBase64Packet = function(msg, binaryType) {
      var type = packetslist[msg.charAt(0)];
      if (!base64encoder) {
        return { type: type, data: { base64: true, data: msg.substr(1) } };
      }

      var data = base64encoder.decode(msg.substr(1));

      if (binaryType === 'blob' && blob) {
        data = new blob([data]);
      }

      return { type: type, data: data };
    };

    /**
     * Encodes multiple messages (payload).
     *
     *     <length>:data
     *
     * Example:
     *
     *     11:hello world2:hi
     *
     * If any contents are binary, they will be encoded as base64 strings. Base64
     * encoded strings are marked with a b before the length specifier
     *
     * @param {Array} packets
     * @api private
     */

    exports.encodePayload = function (packets, supportsBinary, callback) {
      if (typeof supportsBinary === 'function') {
        callback = supportsBinary;
        supportsBinary = null;
      }

      var isBinary = hasBinary2(packets);

      if (supportsBinary && isBinary) {
        if (blob && !dontSendBlobs) {
          return exports.encodePayloadAsBlob(packets, callback);
        }

        return exports.encodePayloadAsArrayBuffer(packets, callback);
      }

      if (!packets.length) {
        return callback('0:');
      }

      function setLengthHeader(message) {
        return message.length + ':' + message;
      }

      function encodeOne(packet, doneCallback) {
        exports.encodePacket(packet, !isBinary ? false : supportsBinary, false, function(message) {
          doneCallback(null, setLengthHeader(message));
        });
      }

      map(packets, encodeOne, function(err, results) {
        return callback(results.join(''));
      });
    };

    /**
     * Async array map using after
     */

    function map(ary, each, done) {
      var result = new Array(ary.length);
      var next = after_1(ary.length, done);

      var eachWithIndex = function(i, el, cb) {
        each(el, function(error, msg) {
          result[i] = msg;
          cb(error, result);
        });
      };

      for (var i = 0; i < ary.length; i++) {
        eachWithIndex(i, ary[i], next);
      }
    }

    /*
     * Decodes data when a payload is maybe expected. Possible binary contents are
     * decoded from their base64 representation
     *
     * @param {String} data, callback method
     * @api public
     */

    exports.decodePayload = function (data, binaryType, callback) {
      if (typeof data !== 'string') {
        return exports.decodePayloadAsBinary(data, binaryType, callback);
      }

      if (typeof binaryType === 'function') {
        callback = binaryType;
        binaryType = null;
      }

      var packet;
      if (data === '') {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      var length = '', n, msg;

      for (var i = 0, l = data.length; i < l; i++) {
        var chr = data.charAt(i);

        if (chr !== ':') {
          length += chr;
          continue;
        }

        if (length === '' || (length != (n = Number(length)))) {
          // parser error - ignoring payload
          return callback(err, 0, 1);
        }

        msg = data.substr(i + 1, n);

        if (length != msg.length) {
          // parser error - ignoring payload
          return callback(err, 0, 1);
        }

        if (msg.length) {
          packet = exports.decodePacket(msg, binaryType, false);

          if (err.type === packet.type && err.data === packet.data) {
            // parser error in individual packet - ignoring payload
            return callback(err, 0, 1);
          }

          var ret = callback(packet, i + n, l);
          if (false === ret) return;
        }

        // advance cursor
        i += n;
        length = '';
      }

      if (length !== '') {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

    };

    /**
     * Encodes multiple messages (payload) as binary.
     *
     * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
     * 255><data>
     *
     * Example:
     * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
     *
     * @param {Array} packets
     * @return {ArrayBuffer} encoded payload
     * @api private
     */

    exports.encodePayloadAsArrayBuffer = function(packets, callback) {
      if (!packets.length) {
        return callback(new ArrayBuffer(0));
      }

      function encodeOne(packet, doneCallback) {
        exports.encodePacket(packet, true, true, function(data) {
          return doneCallback(null, data);
        });
      }

      map(packets, encodeOne, function(err, encodedPackets) {
        var totalLength = encodedPackets.reduce(function(acc, p) {
          var len;
          if (typeof p === 'string'){
            len = p.length;
          } else {
            len = p.byteLength;
          }
          return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
        }, 0);

        var resultArray = new Uint8Array(totalLength);

        var bufferIndex = 0;
        encodedPackets.forEach(function(p) {
          var isString = typeof p === 'string';
          var ab = p;
          if (isString) {
            var view = new Uint8Array(p.length);
            for (var i = 0; i < p.length; i++) {
              view[i] = p.charCodeAt(i);
            }
            ab = view.buffer;
          }

          if (isString) { // not true binary
            resultArray[bufferIndex++] = 0;
          } else { // true binary
            resultArray[bufferIndex++] = 1;
          }

          var lenStr = ab.byteLength.toString();
          for (var i = 0; i < lenStr.length; i++) {
            resultArray[bufferIndex++] = parseInt(lenStr[i]);
          }
          resultArray[bufferIndex++] = 255;

          var view = new Uint8Array(ab);
          for (var i = 0; i < view.length; i++) {
            resultArray[bufferIndex++] = view[i];
          }
        });

        return callback(resultArray.buffer);
      });
    };

    /**
     * Encode as Blob
     */

    exports.encodePayloadAsBlob = function(packets, callback) {
      function encodeOne(packet, doneCallback) {
        exports.encodePacket(packet, true, true, function(encoded) {
          var binaryIdentifier = new Uint8Array(1);
          binaryIdentifier[0] = 1;
          if (typeof encoded === 'string') {
            var view = new Uint8Array(encoded.length);
            for (var i = 0; i < encoded.length; i++) {
              view[i] = encoded.charCodeAt(i);
            }
            encoded = view.buffer;
            binaryIdentifier[0] = 0;
          }

          var len = (encoded instanceof ArrayBuffer)
            ? encoded.byteLength
            : encoded.size;

          var lenStr = len.toString();
          var lengthAry = new Uint8Array(lenStr.length + 1);
          for (var i = 0; i < lenStr.length; i++) {
            lengthAry[i] = parseInt(lenStr[i]);
          }
          lengthAry[lenStr.length] = 255;

          if (blob) {
            var blob$1 = new blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
            doneCallback(null, blob$1);
          }
        });
      }

      map(packets, encodeOne, function(err, results) {
        return callback(new blob(results));
      });
    };

    /*
     * Decodes data when a payload is maybe expected. Strings are decoded by
     * interpreting each byte as a key code for entries marked to start with 0. See
     * description of encodePayloadAsBinary
     *
     * @param {ArrayBuffer} data, callback method
     * @api public
     */

    exports.decodePayloadAsBinary = function (data, binaryType, callback) {
      if (typeof binaryType === 'function') {
        callback = binaryType;
        binaryType = null;
      }

      var bufferTail = data;
      var buffers = [];

      while (bufferTail.byteLength > 0) {
        var tailArray = new Uint8Array(bufferTail);
        var isString = tailArray[0] === 0;
        var msgLength = '';

        for (var i = 1; ; i++) {
          if (tailArray[i] === 255) break;

          // 310 = char length of Number.MAX_VALUE
          if (msgLength.length > 310) {
            return callback(err, 0, 1);
          }

          msgLength += tailArray[i];
        }

        bufferTail = arraybuffer_slice(bufferTail, 2 + msgLength.length);
        msgLength = parseInt(msgLength);

        var msg = arraybuffer_slice(bufferTail, 0, msgLength);
        if (isString) {
          try {
            msg = String.fromCharCode.apply(null, new Uint8Array(msg));
          } catch (e) {
            // iPhone Safari doesn't let you apply to typed arrays
            var typed = new Uint8Array(msg);
            msg = '';
            for (var i = 0; i < typed.length; i++) {
              msg += String.fromCharCode(typed[i]);
            }
          }
        }

        buffers.push(msg);
        bufferTail = arraybuffer_slice(bufferTail, msgLength);
      }

      var total = buffers.length;
      buffers.forEach(function(buffer, i) {
        callback(exports.decodePacket(buffer, binaryType, true), i, total);
      });
    };
    });

    var componentEmitter$1 = createCommonjsModule(function (module) {
    /**
     * Expose `Emitter`.
     */

    {
      module.exports = Emitter;
    }

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter(obj) {
      if (obj) return mixin(obj);
    }
    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin(obj) {
      for (var key in Emitter.prototype) {
        obj[key] = Emitter.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.on =
    Emitter.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.off =
    Emitter.prototype.removeListener =
    Emitter.prototype.removeAllListeners =
    Emitter.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }

      // Remove event specific arrays for event types that no
      // one is subscribed for to avoid memory leak.
      if (callbacks.length === 0) {
        delete this._callbacks['$' + event];
      }

      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};

      var args = new Array(arguments.length - 1)
        , callbacks = this._callbacks['$' + event];

      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };
    });

    /**
     * Module dependencies.
     */




    /**
     * Module exports.
     */

    var transport = Transport;

    /**
     * Transport abstract constructor.
     *
     * @param {Object} options.
     * @api private
     */

    function Transport (opts) {
      this.path = opts.path;
      this.hostname = opts.hostname;
      this.port = opts.port;
      this.secure = opts.secure;
      this.query = opts.query;
      this.timestampParam = opts.timestampParam;
      this.timestampRequests = opts.timestampRequests;
      this.readyState = '';
      this.agent = opts.agent || false;
      this.socket = opts.socket;
      this.enablesXDR = opts.enablesXDR;
      this.withCredentials = opts.withCredentials;

      // SSL options for Node.js client
      this.pfx = opts.pfx;
      this.key = opts.key;
      this.passphrase = opts.passphrase;
      this.cert = opts.cert;
      this.ca = opts.ca;
      this.ciphers = opts.ciphers;
      this.rejectUnauthorized = opts.rejectUnauthorized;
      this.forceNode = opts.forceNode;

      // results of ReactNative environment detection
      this.isReactNative = opts.isReactNative;

      // other options for Node.js client
      this.extraHeaders = opts.extraHeaders;
      this.localAddress = opts.localAddress;
    }

    /**
     * Mix in `Emitter`.
     */

    componentEmitter$1(Transport.prototype);

    /**
     * Emits an error.
     *
     * @param {String} str
     * @return {Transport} for chaining
     * @api public
     */

    Transport.prototype.onError = function (msg, desc) {
      var err = new Error(msg);
      err.type = 'TransportError';
      err.description = desc;
      this.emit('error', err);
      return this;
    };

    /**
     * Opens the transport.
     *
     * @api public
     */

    Transport.prototype.open = function () {
      if ('closed' === this.readyState || '' === this.readyState) {
        this.readyState = 'opening';
        this.doOpen();
      }

      return this;
    };

    /**
     * Closes the transport.
     *
     * @api private
     */

    Transport.prototype.close = function () {
      if ('opening' === this.readyState || 'open' === this.readyState) {
        this.doClose();
        this.onClose();
      }

      return this;
    };

    /**
     * Sends multiple packets.
     *
     * @param {Array} packets
     * @api private
     */

    Transport.prototype.send = function (packets) {
      if ('open' === this.readyState) {
        this.write(packets);
      } else {
        throw new Error('Transport not open');
      }
    };

    /**
     * Called upon open
     *
     * @api private
     */

    Transport.prototype.onOpen = function () {
      this.readyState = 'open';
      this.writable = true;
      this.emit('open');
    };

    /**
     * Called with data.
     *
     * @param {String} data
     * @api private
     */

    Transport.prototype.onData = function (data) {
      var packet = browser$2.decodePacket(data, this.socket.binaryType);
      this.onPacket(packet);
    };

    /**
     * Called with a decoded packet.
     */

    Transport.prototype.onPacket = function (packet) {
      this.emit('packet', packet);
    };

    /**
     * Called upon close.
     *
     * @api private
     */

    Transport.prototype.onClose = function () {
      this.readyState = 'closed';
      this.emit('close');
    };

    /**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */

    var encode = function (obj) {
      var str = '';

      for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          if (str.length) str += '&';
          str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
        }
      }

      return str;
    };

    /**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */

    var decode = function(qs){
      var qry = {};
      var pairs = qs.split('&');
      for (var i = 0, l = pairs.length; i < l; i++) {
        var pair = pairs[i].split('=');
        qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
      return qry;
    };

    var parseqs = {
    	encode: encode,
    	decode: decode
    };

    var componentInherit = function(a, b){
      var fn = function(){};
      fn.prototype = b.prototype;
      a.prototype = new fn;
      a.prototype.constructor = a;
    };

    var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split('')
      , length = 64
      , map = {}
      , seed = 0
      , i = 0
      , prev;

    /**
     * Return a string representing the specified number.
     *
     * @param {Number} num The number to convert.
     * @returns {String} The string representation of the number.
     * @api public
     */
    function encode$1(num) {
      var encoded = '';

      do {
        encoded = alphabet[num % length] + encoded;
        num = Math.floor(num / length);
      } while (num > 0);

      return encoded;
    }

    /**
     * Return the integer value specified by the given string.
     *
     * @param {String} str The string to convert.
     * @returns {Number} The integer value represented by the string.
     * @api public
     */
    function decode$1(str) {
      var decoded = 0;

      for (i = 0; i < str.length; i++) {
        decoded = decoded * length + map[str.charAt(i)];
      }

      return decoded;
    }

    /**
     * Yeast: A tiny growing id generator.
     *
     * @returns {String} A unique id.
     * @api public
     */
    function yeast() {
      var now = encode$1(+new Date());

      if (now !== prev) return seed = 0, prev = now;
      return now +'.'+ encode$1(seed++);
    }

    //
    // Map each character to its index.
    //
    for (; i < length; i++) map[alphabet[i]] = i;

    //
    // Expose the `yeast`, `encode` and `decode` functions.
    //
    yeast.encode = encode$1;
    yeast.decode = decode$1;
    var yeast_1 = yeast;

    /**
     * Helpers.
     */

    var s$2 = 1000;
    var m$2 = s$2 * 60;
    var h$2 = m$2 * 60;
    var d$2 = h$2 * 24;
    var y$2 = d$2 * 365.25;

    /**
     * Parse or format the given `val`.
     *
     * Options:
     *
     *  - `long` verbose formatting [false]
     *
     * @param {String|Number} val
     * @param {Object} [options]
     * @throws {Error} throw an error if val is not a non-empty string or a number
     * @return {String|Number}
     * @api public
     */

    var ms$2 = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === 'string' && val.length > 0) {
        return parse$2(val);
      } else if (type === 'number' && isNaN(val) === false) {
        return options.long ? fmtLong$2(val) : fmtShort$2(val);
      }
      throw new Error(
        'val is not a non-empty string or a valid number. val=' +
          JSON.stringify(val)
      );
    };

    /**
     * Parse the given `str` and return milliseconds.
     *
     * @param {String} str
     * @return {Number}
     * @api private
     */

    function parse$2(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || 'ms').toLowerCase();
      switch (type) {
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
          return n * y$2;
        case 'days':
        case 'day':
        case 'd':
          return n * d$2;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
          return n * h$2;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
          return n * m$2;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
          return n * s$2;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
          return n;
        default:
          return undefined;
      }
    }

    /**
     * Short format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtShort$2(ms) {
      if (ms >= d$2) {
        return Math.round(ms / d$2) + 'd';
      }
      if (ms >= h$2) {
        return Math.round(ms / h$2) + 'h';
      }
      if (ms >= m$2) {
        return Math.round(ms / m$2) + 'm';
      }
      if (ms >= s$2) {
        return Math.round(ms / s$2) + 's';
      }
      return ms + 'ms';
    }

    /**
     * Long format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtLong$2(ms) {
      return plural$2(ms, d$2, 'day') ||
        plural$2(ms, h$2, 'hour') ||
        plural$2(ms, m$2, 'minute') ||
        plural$2(ms, s$2, 'second') ||
        ms + ' ms';
    }

    /**
     * Pluralization helper.
     */

    function plural$2(ms, n, name) {
      if (ms < n) {
        return;
      }
      if (ms < n * 1.5) {
        return Math.floor(ms / n) + ' ' + name;
      }
      return Math.ceil(ms / n) + ' ' + name + 's';
    }

    var debug$2 = createCommonjsModule(function (module, exports) {
    /**
     * This is the common logic for both the Node.js and web browser
     * implementations of `debug()`.
     *
     * Expose `debug()` as the module.
     */

    exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
    exports.coerce = coerce;
    exports.disable = disable;
    exports.enable = enable;
    exports.enabled = enabled;
    exports.humanize = ms$2;

    /**
     * Active `debug` instances.
     */
    exports.instances = [];

    /**
     * The currently active debug mode names, and names to skip.
     */

    exports.names = [];
    exports.skips = [];

    /**
     * Map of special "%n" handling functions, for the debug "format" argument.
     *
     * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
     */

    exports.formatters = {};

    /**
     * Select a color.
     * @param {String} namespace
     * @return {Number}
     * @api private
     */

    function selectColor(namespace) {
      var hash = 0, i;

      for (i in namespace) {
        hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }

      return exports.colors[Math.abs(hash) % exports.colors.length];
    }

    /**
     * Create a debugger with the given `namespace`.
     *
     * @param {String} namespace
     * @return {Function}
     * @api public
     */

    function createDebug(namespace) {

      var prevTime;

      function debug() {
        // disabled?
        if (!debug.enabled) return;

        var self = debug;

        // set `diff` timestamp
        var curr = +new Date();
        var ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;

        // turn the `arguments` into a proper Array
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }

        args[0] = exports.coerce(args[0]);

        if ('string' !== typeof args[0]) {
          // anything else let's inspect with %O
          args.unshift('%O');
        }

        // apply any `formatters` transformations
        var index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
          // if we encounter an escaped % then don't increase the array index
          if (match === '%%') return match;
          index++;
          var formatter = exports.formatters[format];
          if ('function' === typeof formatter) {
            var val = args[index];
            match = formatter.call(self, val);

            // now we need to remove `args[index]` since it's inlined in the `format`
            args.splice(index, 1);
            index--;
          }
          return match;
        });

        // apply env-specific formatting (colors, etc.)
        exports.formatArgs.call(self, args);

        var logFn = debug.log || exports.log || console.log.bind(console);
        logFn.apply(self, args);
      }

      debug.namespace = namespace;
      debug.enabled = exports.enabled(namespace);
      debug.useColors = exports.useColors();
      debug.color = selectColor(namespace);
      debug.destroy = destroy;

      // env-specific initialization logic for debug instances
      if ('function' === typeof exports.init) {
        exports.init(debug);
      }

      exports.instances.push(debug);

      return debug;
    }

    function destroy () {
      var index = exports.instances.indexOf(this);
      if (index !== -1) {
        exports.instances.splice(index, 1);
        return true;
      } else {
        return false;
      }
    }

    /**
     * Enables a debug mode by namespaces. This can include modes
     * separated by a colon and wildcards.
     *
     * @param {String} namespaces
     * @api public
     */

    function enable(namespaces) {
      exports.save(namespaces);

      exports.names = [];
      exports.skips = [];

      var i;
      var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
      var len = split.length;

      for (i = 0; i < len; i++) {
        if (!split[i]) continue; // ignore empty strings
        namespaces = split[i].replace(/\*/g, '.*?');
        if (namespaces[0] === '-') {
          exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
        } else {
          exports.names.push(new RegExp('^' + namespaces + '$'));
        }
      }

      for (i = 0; i < exports.instances.length; i++) {
        var instance = exports.instances[i];
        instance.enabled = exports.enabled(instance.namespace);
      }
    }

    /**
     * Disable debug output.
     *
     * @api public
     */

    function disable() {
      exports.enable('');
    }

    /**
     * Returns true if the given mode name is enabled, false otherwise.
     *
     * @param {String} name
     * @return {Boolean}
     * @api public
     */

    function enabled(name) {
      if (name[name.length - 1] === '*') {
        return true;
      }
      var i, len;
      for (i = 0, len = exports.skips.length; i < len; i++) {
        if (exports.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = exports.names.length; i < len; i++) {
        if (exports.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Coerce `val`.
     *
     * @param {Mixed} val
     * @return {Mixed}
     * @api private
     */

    function coerce(val) {
      if (val instanceof Error) return val.stack || val.message;
      return val;
    }
    });

    var browser$3 = createCommonjsModule(function (module, exports) {
    /**
     * This is the web browser implementation of `debug()`.
     *
     * Expose `debug()` as the module.
     */

    exports = module.exports = debug$2;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = 'undefined' != typeof chrome
                   && 'undefined' != typeof chrome.storage
                      ? chrome.storage.local
                      : localstorage();

    /**
     * Colors.
     */

    exports.colors = [
      '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
      '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
      '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
      '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
      '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
      '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
      '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
      '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
      '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
      '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
      '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
    ];

    /**
     * Currently only WebKit-based Web Inspectors, Firefox >= v31,
     * and the Firebug extension (any Firefox version) are known
     * to support "%c" CSS customizations.
     *
     * TODO: add a `localStorage` variable to explicitly enable/disable colors
     */

    function useColors() {
      // NB: In an Electron preload script, document will be defined but not fully
      // initialized. Since we know we're in Chrome, we'll just detect this case
      // explicitly
      if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
        return true;
      }

      // Internet Explorer and Edge do not support colors.
      if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }

      // is webkit? http://stackoverflow.com/a/16459606/376773
      // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
      return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
        // is firebug? http://stackoverflow.com/a/398120/376773
        (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
        // is firefox >= v31?
        // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
        (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
        // double check webkit in userAgent just in case we are in a worker
        (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
    }

    /**
     * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
     */

    exports.formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (err) {
        return '[UnexpectedJSONParseError]: ' + err.message;
      }
    };


    /**
     * Colorize log arguments if enabled.
     *
     * @api public
     */

    function formatArgs(args) {
      var useColors = this.useColors;

      args[0] = (useColors ? '%c' : '')
        + this.namespace
        + (useColors ? ' %c' : ' ')
        + args[0]
        + (useColors ? '%c ' : ' ')
        + '+' + exports.humanize(this.diff);

      if (!useColors) return;

      var c = 'color: ' + this.color;
      args.splice(1, 0, c, 'color: inherit');

      // the final "%c" is somewhat tricky, because there could be other
      // arguments passed either before or after the %c, so we need to
      // figure out the correct index to insert the CSS into
      var index = 0;
      var lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, function(match) {
        if ('%%' === match) return;
        index++;
        if ('%c' === match) {
          // we only are interested in the *last* %c
          // (the user may have provided their own)
          lastC = index;
        }
      });

      args.splice(lastC, 0, c);
    }

    /**
     * Invokes `console.log()` when available.
     * No-op when `console.log` is not a "function".
     *
     * @api public
     */

    function log() {
      // this hackery is required for IE8/9, where
      // the `console.log` function doesn't have 'apply'
      return 'object' === typeof console
        && console.log
        && Function.prototype.apply.call(console.log, console, arguments);
    }

    /**
     * Save `namespaces`.
     *
     * @param {String} namespaces
     * @api private
     */

    function save(namespaces) {
      try {
        if (null == namespaces) {
          exports.storage.removeItem('debug');
        } else {
          exports.storage.debug = namespaces;
        }
      } catch(e) {}
    }

    /**
     * Load `namespaces`.
     *
     * @return {String} returns the previously persisted debug modes
     * @api private
     */

    function load() {
      var r;
      try {
        r = exports.storage.debug;
      } catch(e) {}

      // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
      if (!r && typeof process !== 'undefined' && 'env' in process) {
        r = process.env.DEBUG;
      }

      return r;
    }

    /**
     * Enable namespaces listed in `localStorage.debug` initially.
     */

    exports.enable(load());

    /**
     * Localstorage attempts to return the localstorage.
     *
     * This is necessary because safari throws
     * when a user disables cookies/localstorage
     * and you attempt to access it.
     *
     * @return {LocalStorage}
     * @api private
     */

    function localstorage() {
      try {
        return window.localStorage;
      } catch (e) {}
    }
    });

    /**
     * Module dependencies.
     */






    var debug$3 = browser$3('engine.io-client:polling');

    /**
     * Module exports.
     */

    var polling = Polling;

    /**
     * Is XHR2 supported?
     */

    var hasXHR2 = (function () {
      var XMLHttpRequest = xmlhttprequest;
      var xhr = new XMLHttpRequest({ xdomain: false });
      return null != xhr.responseType;
    })();

    /**
     * Polling interface.
     *
     * @param {Object} opts
     * @api private
     */

    function Polling (opts) {
      var forceBase64 = (opts && opts.forceBase64);
      if (!hasXHR2 || forceBase64) {
        this.supportsBinary = false;
      }
      transport.call(this, opts);
    }

    /**
     * Inherits from Transport.
     */

    componentInherit(Polling, transport);

    /**
     * Transport name.
     */

    Polling.prototype.name = 'polling';

    /**
     * Opens the socket (triggers polling). We write a PING message to determine
     * when the transport is open.
     *
     * @api private
     */

    Polling.prototype.doOpen = function () {
      this.poll();
    };

    /**
     * Pauses polling.
     *
     * @param {Function} callback upon buffers are flushed and transport is paused
     * @api private
     */

    Polling.prototype.pause = function (onPause) {
      var self = this;

      this.readyState = 'pausing';

      function pause () {
        debug$3('paused');
        self.readyState = 'paused';
        onPause();
      }

      if (this.polling || !this.writable) {
        var total = 0;

        if (this.polling) {
          debug$3('we are currently polling - waiting to pause');
          total++;
          this.once('pollComplete', function () {
            debug$3('pre-pause polling complete');
            --total || pause();
          });
        }

        if (!this.writable) {
          debug$3('we are currently writing - waiting to pause');
          total++;
          this.once('drain', function () {
            debug$3('pre-pause writing complete');
            --total || pause();
          });
        }
      } else {
        pause();
      }
    };

    /**
     * Starts polling cycle.
     *
     * @api public
     */

    Polling.prototype.poll = function () {
      debug$3('polling');
      this.polling = true;
      this.doPoll();
      this.emit('poll');
    };

    /**
     * Overloads onData to detect payloads.
     *
     * @api private
     */

    Polling.prototype.onData = function (data) {
      var self = this;
      debug$3('polling got data %s', data);
      var callback = function (packet, index, total) {
        // if its the first message we consider the transport open
        if ('opening' === self.readyState) {
          self.onOpen();
        }

        // if its a close packet, we close the ongoing requests
        if ('close' === packet.type) {
          self.onClose();
          return false;
        }

        // otherwise bypass onData and handle the message
        self.onPacket(packet);
      };

      // decode payload
      browser$2.decodePayload(data, this.socket.binaryType, callback);

      // if an event did not trigger closing
      if ('closed' !== this.readyState) {
        // if we got data we're not polling
        this.polling = false;
        this.emit('pollComplete');

        if ('open' === this.readyState) {
          this.poll();
        } else {
          debug$3('ignoring poll - transport state "%s"', this.readyState);
        }
      }
    };

    /**
     * For polling, send a close packet.
     *
     * @api private
     */

    Polling.prototype.doClose = function () {
      var self = this;

      function close () {
        debug$3('writing close packet');
        self.write([{ type: 'close' }]);
      }

      if ('open' === this.readyState) {
        debug$3('transport open - closing');
        close();
      } else {
        // in case we're trying to close while
        // handshaking is in progress (GH-164)
        debug$3('transport not open - deferring close');
        this.once('open', close);
      }
    };

    /**
     * Writes a packets payload.
     *
     * @param {Array} data packets
     * @param {Function} drain callback
     * @api private
     */

    Polling.prototype.write = function (packets) {
      var self = this;
      this.writable = false;
      var callbackfn = function () {
        self.writable = true;
        self.emit('drain');
      };

      browser$2.encodePayload(packets, this.supportsBinary, function (data) {
        self.doWrite(data, callbackfn);
      });
    };

    /**
     * Generates uri for connection.
     *
     * @api private
     */

    Polling.prototype.uri = function () {
      var query = this.query || {};
      var schema = this.secure ? 'https' : 'http';
      var port = '';

      // cache busting is forced
      if (false !== this.timestampRequests) {
        query[this.timestampParam] = yeast_1();
      }

      if (!this.supportsBinary && !query.sid) {
        query.b64 = 1;
      }

      query = parseqs.encode(query);

      // avoid port if default for schema
      if (this.port && (('https' === schema && Number(this.port) !== 443) ||
         ('http' === schema && Number(this.port) !== 80))) {
        port = ':' + this.port;
      }

      // prepend ? to query
      if (query.length) {
        query = '?' + query;
      }

      var ipv6 = this.hostname.indexOf(':') !== -1;
      return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
    };

    /* global attachEvent */

    /**
     * Module requirements.
     */





    var debug$4 = browser$3('engine.io-client:polling-xhr');


    /**
     * Module exports.
     */

    var pollingXhr = XHR;
    var Request_1 = Request;

    /**
     * Empty function
     */

    function empty$1 () {}

    /**
     * XHR Polling constructor.
     *
     * @param {Object} opts
     * @api public
     */

    function XHR (opts) {
      polling.call(this, opts);
      this.requestTimeout = opts.requestTimeout;
      this.extraHeaders = opts.extraHeaders;

      if (typeof location !== 'undefined') {
        var isSSL = 'https:' === location.protocol;
        var port = location.port;

        // some user agents have empty `location.port`
        if (!port) {
          port = isSSL ? 443 : 80;
        }

        this.xd = (typeof location !== 'undefined' && opts.hostname !== location.hostname) ||
          port !== opts.port;
        this.xs = opts.secure !== isSSL;
      }
    }

    /**
     * Inherits from Polling.
     */

    componentInherit(XHR, polling);

    /**
     * XHR supports binary
     */

    XHR.prototype.supportsBinary = true;

    /**
     * Creates a request.
     *
     * @param {String} method
     * @api private
     */

    XHR.prototype.request = function (opts) {
      opts = opts || {};
      opts.uri = this.uri();
      opts.xd = this.xd;
      opts.xs = this.xs;
      opts.agent = this.agent || false;
      opts.supportsBinary = this.supportsBinary;
      opts.enablesXDR = this.enablesXDR;
      opts.withCredentials = this.withCredentials;

      // SSL options for Node.js client
      opts.pfx = this.pfx;
      opts.key = this.key;
      opts.passphrase = this.passphrase;
      opts.cert = this.cert;
      opts.ca = this.ca;
      opts.ciphers = this.ciphers;
      opts.rejectUnauthorized = this.rejectUnauthorized;
      opts.requestTimeout = this.requestTimeout;

      // other options for Node.js client
      opts.extraHeaders = this.extraHeaders;

      return new Request(opts);
    };

    /**
     * Sends data.
     *
     * @param {String} data to send.
     * @param {Function} called upon flush.
     * @api private
     */

    XHR.prototype.doWrite = function (data, fn) {
      var isBinary = typeof data !== 'string' && data !== undefined;
      var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
      var self = this;
      req.on('success', fn);
      req.on('error', function (err) {
        self.onError('xhr post error', err);
      });
      this.sendXhr = req;
    };

    /**
     * Starts a poll cycle.
     *
     * @api private
     */

    XHR.prototype.doPoll = function () {
      debug$4('xhr poll');
      var req = this.request();
      var self = this;
      req.on('data', function (data) {
        self.onData(data);
      });
      req.on('error', function (err) {
        self.onError('xhr poll error', err);
      });
      this.pollXhr = req;
    };

    /**
     * Request constructor
     *
     * @param {Object} options
     * @api public
     */

    function Request (opts) {
      this.method = opts.method || 'GET';
      this.uri = opts.uri;
      this.xd = !!opts.xd;
      this.xs = !!opts.xs;
      this.async = false !== opts.async;
      this.data = undefined !== opts.data ? opts.data : null;
      this.agent = opts.agent;
      this.isBinary = opts.isBinary;
      this.supportsBinary = opts.supportsBinary;
      this.enablesXDR = opts.enablesXDR;
      this.withCredentials = opts.withCredentials;
      this.requestTimeout = opts.requestTimeout;

      // SSL options for Node.js client
      this.pfx = opts.pfx;
      this.key = opts.key;
      this.passphrase = opts.passphrase;
      this.cert = opts.cert;
      this.ca = opts.ca;
      this.ciphers = opts.ciphers;
      this.rejectUnauthorized = opts.rejectUnauthorized;

      // other options for Node.js client
      this.extraHeaders = opts.extraHeaders;

      this.create();
    }

    /**
     * Mix in `Emitter`.
     */

    componentEmitter$1(Request.prototype);

    /**
     * Creates the XHR object and sends the request.
     *
     * @api private
     */

    Request.prototype.create = function () {
      var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

      // SSL options for Node.js client
      opts.pfx = this.pfx;
      opts.key = this.key;
      opts.passphrase = this.passphrase;
      opts.cert = this.cert;
      opts.ca = this.ca;
      opts.ciphers = this.ciphers;
      opts.rejectUnauthorized = this.rejectUnauthorized;

      var xhr = this.xhr = new xmlhttprequest(opts);
      var self = this;

      try {
        debug$4('xhr open %s: %s', this.method, this.uri);
        xhr.open(this.method, this.uri, this.async);
        try {
          if (this.extraHeaders) {
            xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
            for (var i in this.extraHeaders) {
              if (this.extraHeaders.hasOwnProperty(i)) {
                xhr.setRequestHeader(i, this.extraHeaders[i]);
              }
            }
          }
        } catch (e) {}

        if ('POST' === this.method) {
          try {
            if (this.isBinary) {
              xhr.setRequestHeader('Content-type', 'application/octet-stream');
            } else {
              xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
            }
          } catch (e) {}
        }

        try {
          xhr.setRequestHeader('Accept', '*/*');
        } catch (e) {}

        // ie6 check
        if ('withCredentials' in xhr) {
          xhr.withCredentials = this.withCredentials;
        }

        if (this.requestTimeout) {
          xhr.timeout = this.requestTimeout;
        }

        if (this.hasXDR()) {
          xhr.onload = function () {
            self.onLoad();
          };
          xhr.onerror = function () {
            self.onError(xhr.responseText);
          };
        } else {
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 2) {
              try {
                var contentType = xhr.getResponseHeader('Content-Type');
                if (self.supportsBinary && contentType === 'application/octet-stream' || contentType === 'application/octet-stream; charset=UTF-8') {
                  xhr.responseType = 'arraybuffer';
                }
              } catch (e) {}
            }
            if (4 !== xhr.readyState) return;
            if (200 === xhr.status || 1223 === xhr.status) {
              self.onLoad();
            } else {
              // make sure the `error` event handler that's user-set
              // does not throw in the same tick and gets caught here
              setTimeout(function () {
                self.onError(typeof xhr.status === 'number' ? xhr.status : 0);
              }, 0);
            }
          };
        }

        debug$4('xhr data %s', this.data);
        xhr.send(this.data);
      } catch (e) {
        // Need to defer since .create() is called directly fhrom the constructor
        // and thus the 'error' event can only be only bound *after* this exception
        // occurs.  Therefore, also, we cannot throw here at all.
        setTimeout(function () {
          self.onError(e);
        }, 0);
        return;
      }

      if (typeof document !== 'undefined') {
        this.index = Request.requestsCount++;
        Request.requests[this.index] = this;
      }
    };

    /**
     * Called upon successful response.
     *
     * @api private
     */

    Request.prototype.onSuccess = function () {
      this.emit('success');
      this.cleanup();
    };

    /**
     * Called if we have data.
     *
     * @api private
     */

    Request.prototype.onData = function (data) {
      this.emit('data', data);
      this.onSuccess();
    };

    /**
     * Called upon error.
     *
     * @api private
     */

    Request.prototype.onError = function (err) {
      this.emit('error', err);
      this.cleanup(true);
    };

    /**
     * Cleans up house.
     *
     * @api private
     */

    Request.prototype.cleanup = function (fromError) {
      if ('undefined' === typeof this.xhr || null === this.xhr) {
        return;
      }
      // xmlhttprequest
      if (this.hasXDR()) {
        this.xhr.onload = this.xhr.onerror = empty$1;
      } else {
        this.xhr.onreadystatechange = empty$1;
      }

      if (fromError) {
        try {
          this.xhr.abort();
        } catch (e) {}
      }

      if (typeof document !== 'undefined') {
        delete Request.requests[this.index];
      }

      this.xhr = null;
    };

    /**
     * Called upon load.
     *
     * @api private
     */

    Request.prototype.onLoad = function () {
      var data;
      try {
        var contentType;
        try {
          contentType = this.xhr.getResponseHeader('Content-Type');
        } catch (e) {}
        if (contentType === 'application/octet-stream' || contentType === 'application/octet-stream; charset=UTF-8') {
          data = this.xhr.response || this.xhr.responseText;
        } else {
          data = this.xhr.responseText;
        }
      } catch (e) {
        this.onError(e);
      }
      if (null != data) {
        this.onData(data);
      }
    };

    /**
     * Check if it has XDomainRequest.
     *
     * @api private
     */

    Request.prototype.hasXDR = function () {
      return typeof XDomainRequest !== 'undefined' && !this.xs && this.enablesXDR;
    };

    /**
     * Aborts the request.
     *
     * @api public
     */

    Request.prototype.abort = function () {
      this.cleanup();
    };

    /**
     * Aborts pending requests when unloading the window. This is needed to prevent
     * memory leaks (e.g. when using IE) and to ensure that no spurious error is
     * emitted.
     */

    Request.requestsCount = 0;
    Request.requests = {};

    if (typeof document !== 'undefined') {
      if (typeof attachEvent === 'function') {
        attachEvent('onunload', unloadHandler);
      } else if (typeof addEventListener === 'function') {
        var terminationEvent = 'onpagehide' in globalThis_browser ? 'pagehide' : 'unload';
        addEventListener(terminationEvent, unloadHandler, false);
      }
    }

    function unloadHandler () {
      for (var i in Request.requests) {
        if (Request.requests.hasOwnProperty(i)) {
          Request.requests[i].abort();
        }
      }
    }
    pollingXhr.Request = Request_1;

    /**
     * Module requirements.
     */





    /**
     * Module exports.
     */

    var pollingJsonp = JSONPPolling;

    /**
     * Cached regular expressions.
     */

    var rNewline = /\n/g;
    var rEscapedNewline = /\\n/g;

    /**
     * Global JSONP callbacks.
     */

    var callbacks;

    /**
     * Noop.
     */

    function empty$2 () { }

    /**
     * JSONP Polling constructor.
     *
     * @param {Object} opts.
     * @api public
     */

    function JSONPPolling (opts) {
      polling.call(this, opts);

      this.query = this.query || {};

      // define global callbacks array if not present
      // we do this here (lazily) to avoid unneeded global pollution
      if (!callbacks) {
        // we need to consider multiple engines in the same page
        callbacks = globalThis_browser.___eio = (globalThis_browser.___eio || []);
      }

      // callback identifier
      this.index = callbacks.length;

      // add callback to jsonp global
      var self = this;
      callbacks.push(function (msg) {
        self.onData(msg);
      });

      // append to query string
      this.query.j = this.index;

      // prevent spurious errors from being emitted when the window is unloaded
      if (typeof addEventListener === 'function') {
        addEventListener('beforeunload', function () {
          if (self.script) self.script.onerror = empty$2;
        }, false);
      }
    }

    /**
     * Inherits from Polling.
     */

    componentInherit(JSONPPolling, polling);

    /*
     * JSONP only supports binary as base64 encoded strings
     */

    JSONPPolling.prototype.supportsBinary = false;

    /**
     * Closes the socket.
     *
     * @api private
     */

    JSONPPolling.prototype.doClose = function () {
      if (this.script) {
        this.script.parentNode.removeChild(this.script);
        this.script = null;
      }

      if (this.form) {
        this.form.parentNode.removeChild(this.form);
        this.form = null;
        this.iframe = null;
      }

      polling.prototype.doClose.call(this);
    };

    /**
     * Starts a poll cycle.
     *
     * @api private
     */

    JSONPPolling.prototype.doPoll = function () {
      var self = this;
      var script = document.createElement('script');

      if (this.script) {
        this.script.parentNode.removeChild(this.script);
        this.script = null;
      }

      script.async = true;
      script.src = this.uri();
      script.onerror = function (e) {
        self.onError('jsonp poll error', e);
      };

      var insertAt = document.getElementsByTagName('script')[0];
      if (insertAt) {
        insertAt.parentNode.insertBefore(script, insertAt);
      } else {
        (document.head || document.body).appendChild(script);
      }
      this.script = script;

      var isUAgecko = 'undefined' !== typeof navigator && /gecko/i.test(navigator.userAgent);

      if (isUAgecko) {
        setTimeout(function () {
          var iframe = document.createElement('iframe');
          document.body.appendChild(iframe);
          document.body.removeChild(iframe);
        }, 100);
      }
    };

    /**
     * Writes with a hidden iframe.
     *
     * @param {String} data to send
     * @param {Function} called upon flush.
     * @api private
     */

    JSONPPolling.prototype.doWrite = function (data, fn) {
      var self = this;

      if (!this.form) {
        var form = document.createElement('form');
        var area = document.createElement('textarea');
        var id = this.iframeId = 'eio_iframe_' + this.index;
        var iframe;

        form.className = 'socketio';
        form.style.position = 'absolute';
        form.style.top = '-1000px';
        form.style.left = '-1000px';
        form.target = id;
        form.method = 'POST';
        form.setAttribute('accept-charset', 'utf-8');
        area.name = 'd';
        form.appendChild(area);
        document.body.appendChild(form);

        this.form = form;
        this.area = area;
      }

      this.form.action = this.uri();

      function complete () {
        initIframe();
        fn();
      }

      function initIframe () {
        if (self.iframe) {
          try {
            self.form.removeChild(self.iframe);
          } catch (e) {
            self.onError('jsonp polling iframe removal error', e);
          }
        }

        try {
          // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
          var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
          iframe = document.createElement(html);
        } catch (e) {
          iframe = document.createElement('iframe');
          iframe.name = self.iframeId;
          iframe.src = 'javascript:0';
        }

        iframe.id = self.iframeId;

        self.form.appendChild(iframe);
        self.iframe = iframe;
      }

      initIframe();

      // escape \n to prevent it from being converted into \r\n by some UAs
      // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
      data = data.replace(rEscapedNewline, '\\\n');
      this.area.value = data.replace(rNewline, '\\n');

      try {
        this.form.submit();
      } catch (e) {}

      if (this.iframe.attachEvent) {
        this.iframe.onreadystatechange = function () {
          if (self.iframe.readyState === 'complete') {
            complete();
          }
        };
      } else {
        this.iframe.onload = complete;
      }
    };

    var _nodeResolve_empty = {};

    var _nodeResolve_empty$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': _nodeResolve_empty
    });

    var require$$1 = getCjsExportFromNamespace(_nodeResolve_empty$1);

    /**
     * Module dependencies.
     */






    var debug$5 = browser$3('engine.io-client:websocket');

    var BrowserWebSocket, NodeWebSocket;

    if (typeof WebSocket !== 'undefined') {
      BrowserWebSocket = WebSocket;
    } else if (typeof self !== 'undefined') {
      BrowserWebSocket = self.WebSocket || self.MozWebSocket;
    }

    if (typeof window === 'undefined') {
      try {
        NodeWebSocket = require$$1;
      } catch (e) { }
    }

    /**
     * Get either the `WebSocket` or `MozWebSocket` globals
     * in the browser or try to resolve WebSocket-compatible
     * interface exposed by `ws` for Node-like environment.
     */

    var WebSocketImpl = BrowserWebSocket || NodeWebSocket;

    /**
     * Module exports.
     */

    var websocket = WS;

    /**
     * WebSocket transport constructor.
     *
     * @api {Object} connection options
     * @api public
     */

    function WS (opts) {
      var forceBase64 = (opts && opts.forceBase64);
      if (forceBase64) {
        this.supportsBinary = false;
      }
      this.perMessageDeflate = opts.perMessageDeflate;
      this.usingBrowserWebSocket = BrowserWebSocket && !opts.forceNode;
      this.protocols = opts.protocols;
      if (!this.usingBrowserWebSocket) {
        WebSocketImpl = NodeWebSocket;
      }
      transport.call(this, opts);
    }

    /**
     * Inherits from Transport.
     */

    componentInherit(WS, transport);

    /**
     * Transport name.
     *
     * @api public
     */

    WS.prototype.name = 'websocket';

    /*
     * WebSockets support binary
     */

    WS.prototype.supportsBinary = true;

    /**
     * Opens socket.
     *
     * @api private
     */

    WS.prototype.doOpen = function () {
      if (!this.check()) {
        // let probe timeout
        return;
      }

      var uri = this.uri();
      var protocols = this.protocols;

      var opts = {};

      if (!this.isReactNative) {
        opts.agent = this.agent;
        opts.perMessageDeflate = this.perMessageDeflate;

        // SSL options for Node.js client
        opts.pfx = this.pfx;
        opts.key = this.key;
        opts.passphrase = this.passphrase;
        opts.cert = this.cert;
        opts.ca = this.ca;
        opts.ciphers = this.ciphers;
        opts.rejectUnauthorized = this.rejectUnauthorized;
      }

      if (this.extraHeaders) {
        opts.headers = this.extraHeaders;
      }
      if (this.localAddress) {
        opts.localAddress = this.localAddress;
      }

      try {
        this.ws =
          this.usingBrowserWebSocket && !this.isReactNative
            ? protocols
              ? new WebSocketImpl(uri, protocols)
              : new WebSocketImpl(uri)
            : new WebSocketImpl(uri, protocols, opts);
      } catch (err) {
        return this.emit('error', err);
      }

      if (this.ws.binaryType === undefined) {
        this.supportsBinary = false;
      }

      if (this.ws.supports && this.ws.supports.binary) {
        this.supportsBinary = true;
        this.ws.binaryType = 'nodebuffer';
      } else {
        this.ws.binaryType = 'arraybuffer';
      }

      this.addEventListeners();
    };

    /**
     * Adds event listeners to the socket
     *
     * @api private
     */

    WS.prototype.addEventListeners = function () {
      var self = this;

      this.ws.onopen = function () {
        self.onOpen();
      };
      this.ws.onclose = function () {
        self.onClose();
      };
      this.ws.onmessage = function (ev) {
        self.onData(ev.data);
      };
      this.ws.onerror = function (e) {
        self.onError('websocket error', e);
      };
    };

    /**
     * Writes data to socket.
     *
     * @param {Array} array of packets.
     * @api private
     */

    WS.prototype.write = function (packets) {
      var self = this;
      this.writable = false;

      // encodePacket efficient as it uses WS framing
      // no need for encodePayload
      var total = packets.length;
      for (var i = 0, l = total; i < l; i++) {
        (function (packet) {
          browser$2.encodePacket(packet, self.supportsBinary, function (data) {
            if (!self.usingBrowserWebSocket) {
              // always create a new object (GH-437)
              var opts = {};
              if (packet.options) {
                opts.compress = packet.options.compress;
              }

              if (self.perMessageDeflate) {
                var len = 'string' === typeof data ? Buffer.byteLength(data) : data.length;
                if (len < self.perMessageDeflate.threshold) {
                  opts.compress = false;
                }
              }
            }

            // Sometimes the websocket has already been closed but the browser didn't
            // have a chance of informing us about it yet, in that case send will
            // throw an error
            try {
              if (self.usingBrowserWebSocket) {
                // TypeError is thrown when passing the second argument on Safari
                self.ws.send(data);
              } else {
                self.ws.send(data, opts);
              }
            } catch (e) {
              debug$5('websocket closed before onclose event');
            }

            --total || done();
          });
        })(packets[i]);
      }

      function done () {
        self.emit('flush');

        // fake drain
        // defer to next tick to allow Socket to clear writeBuffer
        setTimeout(function () {
          self.writable = true;
          self.emit('drain');
        }, 0);
      }
    };

    /**
     * Called upon close
     *
     * @api private
     */

    WS.prototype.onClose = function () {
      transport.prototype.onClose.call(this);
    };

    /**
     * Closes socket.
     *
     * @api private
     */

    WS.prototype.doClose = function () {
      if (typeof this.ws !== 'undefined') {
        this.ws.close();
      }
    };

    /**
     * Generates uri for connection.
     *
     * @api private
     */

    WS.prototype.uri = function () {
      var query = this.query || {};
      var schema = this.secure ? 'wss' : 'ws';
      var port = '';

      // avoid port if default for schema
      if (this.port && (('wss' === schema && Number(this.port) !== 443) ||
        ('ws' === schema && Number(this.port) !== 80))) {
        port = ':' + this.port;
      }

      // append timestamp to URI
      if (this.timestampRequests) {
        query[this.timestampParam] = yeast_1();
      }

      // communicate binary support capabilities
      if (!this.supportsBinary) {
        query.b64 = 1;
      }

      query = parseqs.encode(query);

      // prepend ? to query
      if (query.length) {
        query = '?' + query;
      }

      var ipv6 = this.hostname.indexOf(':') !== -1;
      return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
    };

    /**
     * Feature detection for WebSocket.
     *
     * @return {Boolean} whether this transport is available.
     * @api public
     */

    WS.prototype.check = function () {
      return !!WebSocketImpl && !('__initialize' in WebSocketImpl && this.name === WS.prototype.name);
    };

    /**
     * Module dependencies
     */






    /**
     * Export transports.
     */

    var polling_1 = polling$1;
    var websocket_1 = websocket;

    /**
     * Polling transport polymorphic constructor.
     * Decides on xhr vs jsonp based on feature detection.
     *
     * @api private
     */

    function polling$1 (opts) {
      var xhr;
      var xd = false;
      var xs = false;
      var jsonp = false !== opts.jsonp;

      if (typeof location !== 'undefined') {
        var isSSL = 'https:' === location.protocol;
        var port = location.port;

        // some user agents have empty `location.port`
        if (!port) {
          port = isSSL ? 443 : 80;
        }

        xd = opts.hostname !== location.hostname || port !== opts.port;
        xs = opts.secure !== isSSL;
      }

      opts.xdomain = xd;
      opts.xscheme = xs;
      xhr = new xmlhttprequest(opts);

      if ('open' in xhr && !opts.forceJSONP) {
        return new pollingXhr(opts);
      } else {
        if (!jsonp) throw new Error('JSONP disabled');
        return new pollingJsonp(opts);
      }
    }

    var transports = {
    	polling: polling_1,
    	websocket: websocket_1
    };

    var indexOf = [].indexOf;

    var indexof = function(arr, obj){
      if (indexOf) return arr.indexOf(obj);
      for (var i = 0; i < arr.length; ++i) {
        if (arr[i] === obj) return i;
      }
      return -1;
    };

    /**
     * Parses an URI
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */

    var re$1 = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

    var parts$1 = [
        'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
    ];

    var parseuri$1 = function parseuri(str) {
        var src = str,
            b = str.indexOf('['),
            e = str.indexOf(']');

        if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
        }

        var m = re$1.exec(str || ''),
            uri = {},
            i = 14;

        while (i--) {
            uri[parts$1[i]] = m[i] || '';
        }

        if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
            uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
            uri.ipv6uri = true;
        }

        uri.pathNames = pathNames(uri, uri['path']);
        uri.queryKey = queryKey(uri, uri['query']);

        return uri;
    };

    function pathNames(obj, path) {
        var regx = /\/{2,9}/g,
            names = path.replace(regx, "/").split("/");

        if (path.substr(0, 1) == '/' || path.length === 0) {
            names.splice(0, 1);
        }
        if (path.substr(path.length - 1, 1) == '/') {
            names.splice(names.length - 1, 1);
        }

        return names;
    }

    function queryKey(uri, query) {
        var data = {};

        query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
            if ($1) {
                data[$1] = $2;
            }
        });

        return data;
    }

    /**
     * Module dependencies.
     */



    var debug$6 = browser$3('engine.io-client:socket');





    /**
     * Module exports.
     */

    var socket = Socket;

    /**
     * Socket constructor.
     *
     * @param {String|Object} uri or options
     * @param {Object} options
     * @api public
     */

    function Socket (uri, opts) {
      if (!(this instanceof Socket)) return new Socket(uri, opts);

      opts = opts || {};

      if (uri && 'object' === typeof uri) {
        opts = uri;
        uri = null;
      }

      if (uri) {
        uri = parseuri$1(uri);
        opts.hostname = uri.host;
        opts.secure = uri.protocol === 'https' || uri.protocol === 'wss';
        opts.port = uri.port;
        if (uri.query) opts.query = uri.query;
      } else if (opts.host) {
        opts.hostname = parseuri$1(opts.host).host;
      }

      this.secure = null != opts.secure ? opts.secure
        : (typeof location !== 'undefined' && 'https:' === location.protocol);

      if (opts.hostname && !opts.port) {
        // if no port is specified manually, use the protocol default
        opts.port = this.secure ? '443' : '80';
      }

      this.agent = opts.agent || false;
      this.hostname = opts.hostname ||
        (typeof location !== 'undefined' ? location.hostname : 'localhost');
      this.port = opts.port || (typeof location !== 'undefined' && location.port
          ? location.port
          : (this.secure ? 443 : 80));
      this.query = opts.query || {};
      if ('string' === typeof this.query) this.query = parseqs.decode(this.query);
      this.upgrade = false !== opts.upgrade;
      this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
      this.forceJSONP = !!opts.forceJSONP;
      this.jsonp = false !== opts.jsonp;
      this.forceBase64 = !!opts.forceBase64;
      this.enablesXDR = !!opts.enablesXDR;
      this.withCredentials = false !== opts.withCredentials;
      this.timestampParam = opts.timestampParam || 't';
      this.timestampRequests = opts.timestampRequests;
      this.transports = opts.transports || ['polling', 'websocket'];
      this.transportOptions = opts.transportOptions || {};
      this.readyState = '';
      this.writeBuffer = [];
      this.prevBufferLen = 0;
      this.policyPort = opts.policyPort || 843;
      this.rememberUpgrade = opts.rememberUpgrade || false;
      this.binaryType = null;
      this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
      this.perMessageDeflate = false !== opts.perMessageDeflate ? (opts.perMessageDeflate || {}) : false;

      if (true === this.perMessageDeflate) this.perMessageDeflate = {};
      if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
        this.perMessageDeflate.threshold = 1024;
      }

      // SSL options for Node.js client
      this.pfx = opts.pfx || null;
      this.key = opts.key || null;
      this.passphrase = opts.passphrase || null;
      this.cert = opts.cert || null;
      this.ca = opts.ca || null;
      this.ciphers = opts.ciphers || null;
      this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? true : opts.rejectUnauthorized;
      this.forceNode = !!opts.forceNode;

      // detect ReactNative environment
      this.isReactNative = (typeof navigator !== 'undefined' && typeof navigator.product === 'string' && navigator.product.toLowerCase() === 'reactnative');

      // other options for Node.js or ReactNative client
      if (typeof self === 'undefined' || this.isReactNative) {
        if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
          this.extraHeaders = opts.extraHeaders;
        }

        if (opts.localAddress) {
          this.localAddress = opts.localAddress;
        }
      }

      // set on handshake
      this.id = null;
      this.upgrades = null;
      this.pingInterval = null;
      this.pingTimeout = null;

      // set on heartbeat
      this.pingIntervalTimer = null;
      this.pingTimeoutTimer = null;

      this.open();
    }

    Socket.priorWebsocketSuccess = false;

    /**
     * Mix in `Emitter`.
     */

    componentEmitter$1(Socket.prototype);

    /**
     * Protocol version.
     *
     * @api public
     */

    Socket.protocol = browser$2.protocol; // this is an int

    /**
     * Expose deps for legacy compatibility
     * and standalone browser access.
     */

    Socket.Socket = Socket;
    Socket.Transport = transport;
    Socket.transports = transports;
    Socket.parser = browser$2;

    /**
     * Creates transport of the given type.
     *
     * @param {String} transport name
     * @return {Transport}
     * @api private
     */

    Socket.prototype.createTransport = function (name) {
      debug$6('creating transport "%s"', name);
      var query = clone$1(this.query);

      // append engine.io protocol identifier
      query.EIO = browser$2.protocol;

      // transport name
      query.transport = name;

      // per-transport options
      var options = this.transportOptions[name] || {};

      // session id if we already have one
      if (this.id) query.sid = this.id;

      var transport = new transports[name]({
        query: query,
        socket: this,
        agent: options.agent || this.agent,
        hostname: options.hostname || this.hostname,
        port: options.port || this.port,
        secure: options.secure || this.secure,
        path: options.path || this.path,
        forceJSONP: options.forceJSONP || this.forceJSONP,
        jsonp: options.jsonp || this.jsonp,
        forceBase64: options.forceBase64 || this.forceBase64,
        enablesXDR: options.enablesXDR || this.enablesXDR,
        withCredentials: options.withCredentials || this.withCredentials,
        timestampRequests: options.timestampRequests || this.timestampRequests,
        timestampParam: options.timestampParam || this.timestampParam,
        policyPort: options.policyPort || this.policyPort,
        pfx: options.pfx || this.pfx,
        key: options.key || this.key,
        passphrase: options.passphrase || this.passphrase,
        cert: options.cert || this.cert,
        ca: options.ca || this.ca,
        ciphers: options.ciphers || this.ciphers,
        rejectUnauthorized: options.rejectUnauthorized || this.rejectUnauthorized,
        perMessageDeflate: options.perMessageDeflate || this.perMessageDeflate,
        extraHeaders: options.extraHeaders || this.extraHeaders,
        forceNode: options.forceNode || this.forceNode,
        localAddress: options.localAddress || this.localAddress,
        requestTimeout: options.requestTimeout || this.requestTimeout,
        protocols: options.protocols || void (0),
        isReactNative: this.isReactNative
      });

      return transport;
    };

    function clone$1 (obj) {
      var o = {};
      for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          o[i] = obj[i];
        }
      }
      return o;
    }

    /**
     * Initializes transport to use and starts probe.
     *
     * @api private
     */
    Socket.prototype.open = function () {
      var transport;
      if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') !== -1) {
        transport = 'websocket';
      } else if (0 === this.transports.length) {
        // Emit error on next tick so it can be listened to
        var self = this;
        setTimeout(function () {
          self.emit('error', 'No transports available');
        }, 0);
        return;
      } else {
        transport = this.transports[0];
      }
      this.readyState = 'opening';

      // Retry with the next transport if the transport is disabled (jsonp: false)
      try {
        transport = this.createTransport(transport);
      } catch (e) {
        this.transports.shift();
        this.open();
        return;
      }

      transport.open();
      this.setTransport(transport);
    };

    /**
     * Sets the current transport. Disables the existing one (if any).
     *
     * @api private
     */

    Socket.prototype.setTransport = function (transport) {
      debug$6('setting transport %s', transport.name);
      var self = this;

      if (this.transport) {
        debug$6('clearing existing transport %s', this.transport.name);
        this.transport.removeAllListeners();
      }

      // set up transport
      this.transport = transport;

      // set up transport listeners
      transport
      .on('drain', function () {
        self.onDrain();
      })
      .on('packet', function (packet) {
        self.onPacket(packet);
      })
      .on('error', function (e) {
        self.onError(e);
      })
      .on('close', function () {
        self.onClose('transport close');
      });
    };

    /**
     * Probes a transport.
     *
     * @param {String} transport name
     * @api private
     */

    Socket.prototype.probe = function (name) {
      debug$6('probing transport "%s"', name);
      var transport = this.createTransport(name, { probe: 1 });
      var failed = false;
      var self = this;

      Socket.priorWebsocketSuccess = false;

      function onTransportOpen () {
        if (self.onlyBinaryUpgrades) {
          var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
          failed = failed || upgradeLosesBinary;
        }
        if (failed) return;

        debug$6('probe transport "%s" opened', name);
        transport.send([{ type: 'ping', data: 'probe' }]);
        transport.once('packet', function (msg) {
          if (failed) return;
          if ('pong' === msg.type && 'probe' === msg.data) {
            debug$6('probe transport "%s" pong', name);
            self.upgrading = true;
            self.emit('upgrading', transport);
            if (!transport) return;
            Socket.priorWebsocketSuccess = 'websocket' === transport.name;

            debug$6('pausing current transport "%s"', self.transport.name);
            self.transport.pause(function () {
              if (failed) return;
              if ('closed' === self.readyState) return;
              debug$6('changing transport and sending upgrade packet');

              cleanup();

              self.setTransport(transport);
              transport.send([{ type: 'upgrade' }]);
              self.emit('upgrade', transport);
              transport = null;
              self.upgrading = false;
              self.flush();
            });
          } else {
            debug$6('probe transport "%s" failed', name);
            var err = new Error('probe error');
            err.transport = transport.name;
            self.emit('upgradeError', err);
          }
        });
      }

      function freezeTransport () {
        if (failed) return;

        // Any callback called by transport should be ignored since now
        failed = true;

        cleanup();

        transport.close();
        transport = null;
      }

      // Handle any error that happens while probing
      function onerror (err) {
        var error = new Error('probe error: ' + err);
        error.transport = transport.name;

        freezeTransport();

        debug$6('probe transport "%s" failed because of error: %s', name, err);

        self.emit('upgradeError', error);
      }

      function onTransportClose () {
        onerror('transport closed');
      }

      // When the socket is closed while we're probing
      function onclose () {
        onerror('socket closed');
      }

      // When the socket is upgraded while we're probing
      function onupgrade (to) {
        if (transport && to.name !== transport.name) {
          debug$6('"%s" works - aborting "%s"', to.name, transport.name);
          freezeTransport();
        }
      }

      // Remove all listeners on the transport and on self
      function cleanup () {
        transport.removeListener('open', onTransportOpen);
        transport.removeListener('error', onerror);
        transport.removeListener('close', onTransportClose);
        self.removeListener('close', onclose);
        self.removeListener('upgrading', onupgrade);
      }

      transport.once('open', onTransportOpen);
      transport.once('error', onerror);
      transport.once('close', onTransportClose);

      this.once('close', onclose);
      this.once('upgrading', onupgrade);

      transport.open();
    };

    /**
     * Called when connection is deemed open.
     *
     * @api public
     */

    Socket.prototype.onOpen = function () {
      debug$6('socket open');
      this.readyState = 'open';
      Socket.priorWebsocketSuccess = 'websocket' === this.transport.name;
      this.emit('open');
      this.flush();

      // we check for `readyState` in case an `open`
      // listener already closed the socket
      if ('open' === this.readyState && this.upgrade && this.transport.pause) {
        debug$6('starting upgrade probes');
        for (var i = 0, l = this.upgrades.length; i < l; i++) {
          this.probe(this.upgrades[i]);
        }
      }
    };

    /**
     * Handles a packet.
     *
     * @api private
     */

    Socket.prototype.onPacket = function (packet) {
      if ('opening' === this.readyState || 'open' === this.readyState ||
          'closing' === this.readyState) {
        debug$6('socket receive: type "%s", data "%s"', packet.type, packet.data);

        this.emit('packet', packet);

        // Socket is live - any packet counts
        this.emit('heartbeat');

        switch (packet.type) {
          case 'open':
            this.onHandshake(JSON.parse(packet.data));
            break;

          case 'pong':
            this.setPing();
            this.emit('pong');
            break;

          case 'error':
            var err = new Error('server error');
            err.code = packet.data;
            this.onError(err);
            break;

          case 'message':
            this.emit('data', packet.data);
            this.emit('message', packet.data);
            break;
        }
      } else {
        debug$6('packet received with socket readyState "%s"', this.readyState);
      }
    };

    /**
     * Called upon handshake completion.
     *
     * @param {Object} handshake obj
     * @api private
     */

    Socket.prototype.onHandshake = function (data) {
      this.emit('handshake', data);
      this.id = data.sid;
      this.transport.query.sid = data.sid;
      this.upgrades = this.filterUpgrades(data.upgrades);
      this.pingInterval = data.pingInterval;
      this.pingTimeout = data.pingTimeout;
      this.onOpen();
      // In case open handler closes socket
      if ('closed' === this.readyState) return;
      this.setPing();

      // Prolong liveness of socket on heartbeat
      this.removeListener('heartbeat', this.onHeartbeat);
      this.on('heartbeat', this.onHeartbeat);
    };

    /**
     * Resets ping timeout.
     *
     * @api private
     */

    Socket.prototype.onHeartbeat = function (timeout) {
      clearTimeout(this.pingTimeoutTimer);
      var self = this;
      self.pingTimeoutTimer = setTimeout(function () {
        if ('closed' === self.readyState) return;
        self.onClose('ping timeout');
      }, timeout || (self.pingInterval + self.pingTimeout));
    };

    /**
     * Pings server every `this.pingInterval` and expects response
     * within `this.pingTimeout` or closes connection.
     *
     * @api private
     */

    Socket.prototype.setPing = function () {
      var self = this;
      clearTimeout(self.pingIntervalTimer);
      self.pingIntervalTimer = setTimeout(function () {
        debug$6('writing ping packet - expecting pong within %sms', self.pingTimeout);
        self.ping();
        self.onHeartbeat(self.pingTimeout);
      }, self.pingInterval);
    };

    /**
    * Sends a ping packet.
    *
    * @api private
    */

    Socket.prototype.ping = function () {
      var self = this;
      this.sendPacket('ping', function () {
        self.emit('ping');
      });
    };

    /**
     * Called on `drain` event
     *
     * @api private
     */

    Socket.prototype.onDrain = function () {
      this.writeBuffer.splice(0, this.prevBufferLen);

      // setting prevBufferLen = 0 is very important
      // for example, when upgrading, upgrade packet is sent over,
      // and a nonzero prevBufferLen could cause problems on `drain`
      this.prevBufferLen = 0;

      if (0 === this.writeBuffer.length) {
        this.emit('drain');
      } else {
        this.flush();
      }
    };

    /**
     * Flush write buffers.
     *
     * @api private
     */

    Socket.prototype.flush = function () {
      if ('closed' !== this.readyState && this.transport.writable &&
        !this.upgrading && this.writeBuffer.length) {
        debug$6('flushing %d packets in socket', this.writeBuffer.length);
        this.transport.send(this.writeBuffer);
        // keep track of current length of writeBuffer
        // splice writeBuffer and callbackBuffer on `drain`
        this.prevBufferLen = this.writeBuffer.length;
        this.emit('flush');
      }
    };

    /**
     * Sends a message.
     *
     * @param {String} message.
     * @param {Function} callback function.
     * @param {Object} options.
     * @return {Socket} for chaining.
     * @api public
     */

    Socket.prototype.write =
    Socket.prototype.send = function (msg, options, fn) {
      this.sendPacket('message', msg, options, fn);
      return this;
    };

    /**
     * Sends a packet.
     *
     * @param {String} packet type.
     * @param {String} data.
     * @param {Object} options.
     * @param {Function} callback function.
     * @api private
     */

    Socket.prototype.sendPacket = function (type, data, options, fn) {
      if ('function' === typeof data) {
        fn = data;
        data = undefined;
      }

      if ('function' === typeof options) {
        fn = options;
        options = null;
      }

      if ('closing' === this.readyState || 'closed' === this.readyState) {
        return;
      }

      options = options || {};
      options.compress = false !== options.compress;

      var packet = {
        type: type,
        data: data,
        options: options
      };
      this.emit('packetCreate', packet);
      this.writeBuffer.push(packet);
      if (fn) this.once('flush', fn);
      this.flush();
    };

    /**
     * Closes the connection.
     *
     * @api private
     */

    Socket.prototype.close = function () {
      if ('opening' === this.readyState || 'open' === this.readyState) {
        this.readyState = 'closing';

        var self = this;

        if (this.writeBuffer.length) {
          this.once('drain', function () {
            if (this.upgrading) {
              waitForUpgrade();
            } else {
              close();
            }
          });
        } else if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      }

      function close () {
        self.onClose('forced close');
        debug$6('socket closing - telling transport to close');
        self.transport.close();
      }

      function cleanupAndClose () {
        self.removeListener('upgrade', cleanupAndClose);
        self.removeListener('upgradeError', cleanupAndClose);
        close();
      }

      function waitForUpgrade () {
        // wait for upgrade to finish since we can't send packets while pausing a transport
        self.once('upgrade', cleanupAndClose);
        self.once('upgradeError', cleanupAndClose);
      }

      return this;
    };

    /**
     * Called upon transport error
     *
     * @api private
     */

    Socket.prototype.onError = function (err) {
      debug$6('socket error %j', err);
      Socket.priorWebsocketSuccess = false;
      this.emit('error', err);
      this.onClose('transport error', err);
    };

    /**
     * Called upon transport close.
     *
     * @api private
     */

    Socket.prototype.onClose = function (reason, desc) {
      if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
        debug$6('socket close with reason: "%s"', reason);
        var self = this;

        // clear timers
        clearTimeout(this.pingIntervalTimer);
        clearTimeout(this.pingTimeoutTimer);

        // stop event from firing again for transport
        this.transport.removeAllListeners('close');

        // ensure transport won't stay open
        this.transport.close();

        // ignore further transport communication
        this.transport.removeAllListeners();

        // set ready state
        this.readyState = 'closed';

        // clear session id
        this.id = null;

        // emit close event
        this.emit('close', reason, desc);

        // clean buffers after, so users can still
        // grab the buffers on `close` event
        self.writeBuffer = [];
        self.prevBufferLen = 0;
      }
    };

    /**
     * Filters upgrades, returning only those matching client transports.
     *
     * @param {Array} server upgrades
     * @api private
     *
     */

    Socket.prototype.filterUpgrades = function (upgrades) {
      var filteredUpgrades = [];
      for (var i = 0, j = upgrades.length; i < j; i++) {
        if (~indexof(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
      }
      return filteredUpgrades;
    };

    var lib$1 = socket;

    /**
     * Exports parser
     *
     * @api public
     *
     */
    var parser = browser$2;
    lib$1.parser = parser;

    var componentEmitter$2 = createCommonjsModule(function (module) {
    /**
     * Expose `Emitter`.
     */

    {
      module.exports = Emitter;
    }

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter(obj) {
      if (obj) return mixin(obj);
    }
    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin(obj) {
      for (var key in Emitter.prototype) {
        obj[key] = Emitter.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.on =
    Emitter.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.off =
    Emitter.prototype.removeListener =
    Emitter.prototype.removeAllListeners =
    Emitter.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }
      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};
      var args = [].slice.call(arguments, 1)
        , callbacks = this._callbacks['$' + event];

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };
    });

    var toArray_1 = toArray;

    function toArray(list, index) {
        var array = [];

        index = index || 0;

        for (var i = index || 0; i < list.length; i++) {
            array[i - index] = list[i];
        }

        return array
    }

    /**
     * Module exports.
     */

    var on_1 = on;

    /**
     * Helper for subscriptions.
     *
     * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
     * @param {String} event name
     * @param {Function} callback
     * @api public
     */

    function on (obj, ev, fn) {
      obj.on(ev, fn);
      return {
        destroy: function () {
          obj.removeListener(ev, fn);
        }
      };
    }

    /**
     * Slice reference.
     */

    var slice = [].slice;

    /**
     * Bind `obj` to `fn`.
     *
     * @param {Object} obj
     * @param {Function|String} fn or string
     * @return {Function}
     * @api public
     */

    var componentBind = function(obj, fn){
      if ('string' == typeof fn) fn = obj[fn];
      if ('function' != typeof fn) throw new Error('bind() requires a function');
      var args = slice.call(arguments, 2);
      return function(){
        return fn.apply(obj, args.concat(slice.call(arguments)));
      }
    };

    /**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */

    var encode$2 = function (obj) {
      var str = '';

      for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          if (str.length) str += '&';
          str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
        }
      }

      return str;
    };

    /**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */

    var decode$2 = function(qs){
      var qry = {};
      var pairs = qs.split('&');
      for (var i = 0, l = pairs.length; i < l; i++) {
        var pair = pairs[i].split('=');
        qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
      return qry;
    };

    var parseqs$1 = {
    	encode: encode$2,
    	decode: decode$2
    };

    var socket$1 = createCommonjsModule(function (module, exports) {
    /**
     * Module dependencies.
     */






    var debug = browser('socket.io-client:socket');



    /**
     * Module exports.
     */

    module.exports = exports = Socket;

    /**
     * Internal events (blacklisted).
     * These events can't be emitted by the user.
     *
     * @api private
     */

    var events = {
      connect: 1,
      connect_error: 1,
      connect_timeout: 1,
      connecting: 1,
      disconnect: 1,
      error: 1,
      reconnect: 1,
      reconnect_attempt: 1,
      reconnect_failed: 1,
      reconnect_error: 1,
      reconnecting: 1,
      ping: 1,
      pong: 1
    };

    /**
     * Shortcut to `Emitter#emit`.
     */

    var emit = componentEmitter$2.prototype.emit;

    /**
     * `Socket` constructor.
     *
     * @api public
     */

    function Socket (io, nsp, opts) {
      this.io = io;
      this.nsp = nsp;
      this.json = this; // compat
      this.ids = 0;
      this.acks = {};
      this.receiveBuffer = [];
      this.sendBuffer = [];
      this.connected = false;
      this.disconnected = true;
      this.flags = {};
      if (opts && opts.query) {
        this.query = opts.query;
      }
      if (this.io.autoConnect) this.open();
    }

    /**
     * Mix in `Emitter`.
     */

    componentEmitter$2(Socket.prototype);

    /**
     * Subscribe to open, close and packet events
     *
     * @api private
     */

    Socket.prototype.subEvents = function () {
      if (this.subs) return;

      var io = this.io;
      this.subs = [
        on_1(io, 'open', componentBind(this, 'onopen')),
        on_1(io, 'packet', componentBind(this, 'onpacket')),
        on_1(io, 'close', componentBind(this, 'onclose'))
      ];
    };

    /**
     * "Opens" the socket.
     *
     * @api public
     */

    Socket.prototype.open =
    Socket.prototype.connect = function () {
      if (this.connected) return this;

      this.subEvents();
      this.io.open(); // ensure open
      if ('open' === this.io.readyState) this.onopen();
      this.emit('connecting');
      return this;
    };

    /**
     * Sends a `message` event.
     *
     * @return {Socket} self
     * @api public
     */

    Socket.prototype.send = function () {
      var args = toArray_1(arguments);
      args.unshift('message');
      this.emit.apply(this, args);
      return this;
    };

    /**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @param {String} event name
     * @return {Socket} self
     * @api public
     */

    Socket.prototype.emit = function (ev) {
      if (events.hasOwnProperty(ev)) {
        emit.apply(this, arguments);
        return this;
      }

      var args = toArray_1(arguments);
      var packet = {
        type: (this.flags.binary !== undefined ? this.flags.binary : hasBinary2(args)) ? socket_ioParser.BINARY_EVENT : socket_ioParser.EVENT,
        data: args
      };

      packet.options = {};
      packet.options.compress = !this.flags || false !== this.flags.compress;

      // event ack callback
      if ('function' === typeof args[args.length - 1]) {
        debug('emitting packet with ack id %d', this.ids);
        this.acks[this.ids] = args.pop();
        packet.id = this.ids++;
      }

      if (this.connected) {
        this.packet(packet);
      } else {
        this.sendBuffer.push(packet);
      }

      this.flags = {};

      return this;
    };

    /**
     * Sends a packet.
     *
     * @param {Object} packet
     * @api private
     */

    Socket.prototype.packet = function (packet) {
      packet.nsp = this.nsp;
      this.io.packet(packet);
    };

    /**
     * Called upon engine `open`.
     *
     * @api private
     */

    Socket.prototype.onopen = function () {
      debug('transport is open - connecting');

      // write connect packet if necessary
      if ('/' !== this.nsp) {
        if (this.query) {
          var query = typeof this.query === 'object' ? parseqs$1.encode(this.query) : this.query;
          debug('sending connect packet with query %s', query);
          this.packet({type: socket_ioParser.CONNECT, query: query});
        } else {
          this.packet({type: socket_ioParser.CONNECT});
        }
      }
    };

    /**
     * Called upon engine `close`.
     *
     * @param {String} reason
     * @api private
     */

    Socket.prototype.onclose = function (reason) {
      debug('close (%s)', reason);
      this.connected = false;
      this.disconnected = true;
      delete this.id;
      this.emit('disconnect', reason);
    };

    /**
     * Called with socket packet.
     *
     * @param {Object} packet
     * @api private
     */

    Socket.prototype.onpacket = function (packet) {
      var sameNamespace = packet.nsp === this.nsp;
      var rootNamespaceError = packet.type === socket_ioParser.ERROR && packet.nsp === '/';

      if (!sameNamespace && !rootNamespaceError) return;

      switch (packet.type) {
        case socket_ioParser.CONNECT:
          this.onconnect();
          break;

        case socket_ioParser.EVENT:
          this.onevent(packet);
          break;

        case socket_ioParser.BINARY_EVENT:
          this.onevent(packet);
          break;

        case socket_ioParser.ACK:
          this.onack(packet);
          break;

        case socket_ioParser.BINARY_ACK:
          this.onack(packet);
          break;

        case socket_ioParser.DISCONNECT:
          this.ondisconnect();
          break;

        case socket_ioParser.ERROR:
          this.emit('error', packet.data);
          break;
      }
    };

    /**
     * Called upon a server event.
     *
     * @param {Object} packet
     * @api private
     */

    Socket.prototype.onevent = function (packet) {
      var args = packet.data || [];
      debug('emitting event %j', args);

      if (null != packet.id) {
        debug('attaching ack callback to event');
        args.push(this.ack(packet.id));
      }

      if (this.connected) {
        emit.apply(this, args);
      } else {
        this.receiveBuffer.push(args);
      }
    };

    /**
     * Produces an ack callback to emit with an event.
     *
     * @api private
     */

    Socket.prototype.ack = function (id) {
      var self = this;
      var sent = false;
      return function () {
        // prevent double callbacks
        if (sent) return;
        sent = true;
        var args = toArray_1(arguments);
        debug('sending ack %j', args);

        self.packet({
          type: hasBinary2(args) ? socket_ioParser.BINARY_ACK : socket_ioParser.ACK,
          id: id,
          data: args
        });
      };
    };

    /**
     * Called upon a server acknowlegement.
     *
     * @param {Object} packet
     * @api private
     */

    Socket.prototype.onack = function (packet) {
      var ack = this.acks[packet.id];
      if ('function' === typeof ack) {
        debug('calling ack %s with %j', packet.id, packet.data);
        ack.apply(this, packet.data);
        delete this.acks[packet.id];
      } else {
        debug('bad ack %s', packet.id);
      }
    };

    /**
     * Called upon server connect.
     *
     * @api private
     */

    Socket.prototype.onconnect = function () {
      this.connected = true;
      this.disconnected = false;
      this.emit('connect');
      this.emitBuffered();
    };

    /**
     * Emit buffered events (received and emitted).
     *
     * @api private
     */

    Socket.prototype.emitBuffered = function () {
      var i;
      for (i = 0; i < this.receiveBuffer.length; i++) {
        emit.apply(this, this.receiveBuffer[i]);
      }
      this.receiveBuffer = [];

      for (i = 0; i < this.sendBuffer.length; i++) {
        this.packet(this.sendBuffer[i]);
      }
      this.sendBuffer = [];
    };

    /**
     * Called upon server disconnect.
     *
     * @api private
     */

    Socket.prototype.ondisconnect = function () {
      debug('server disconnect (%s)', this.nsp);
      this.destroy();
      this.onclose('io server disconnect');
    };

    /**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @api private.
     */

    Socket.prototype.destroy = function () {
      if (this.subs) {
        // clean subscriptions to avoid reconnections
        for (var i = 0; i < this.subs.length; i++) {
          this.subs[i].destroy();
        }
        this.subs = null;
      }

      this.io.destroy(this);
    };

    /**
     * Disconnects the socket manually.
     *
     * @return {Socket} self
     * @api public
     */

    Socket.prototype.close =
    Socket.prototype.disconnect = function () {
      if (this.connected) {
        debug('performing disconnect (%s)', this.nsp);
        this.packet({ type: socket_ioParser.DISCONNECT });
      }

      // remove socket from pool
      this.destroy();

      if (this.connected) {
        // fire events
        this.onclose('io client disconnect');
      }
      return this;
    };

    /**
     * Sets the compress flag.
     *
     * @param {Boolean} if `true`, compresses the sending data
     * @return {Socket} self
     * @api public
     */

    Socket.prototype.compress = function (compress) {
      this.flags.compress = compress;
      return this;
    };

    /**
     * Sets the binary flag
     *
     * @param {Boolean} whether the emitted data contains binary
     * @return {Socket} self
     * @api public
     */

    Socket.prototype.binary = function (binary) {
      this.flags.binary = binary;
      return this;
    };
    });

    /**
     * Expose `Backoff`.
     */

    var backo2 = Backoff;

    /**
     * Initialize backoff timer with `opts`.
     *
     * - `min` initial timeout in milliseconds [100]
     * - `max` max timeout [10000]
     * - `jitter` [0]
     * - `factor` [2]
     *
     * @param {Object} opts
     * @api public
     */

    function Backoff(opts) {
      opts = opts || {};
      this.ms = opts.min || 100;
      this.max = opts.max || 10000;
      this.factor = opts.factor || 2;
      this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
      this.attempts = 0;
    }

    /**
     * Return the backoff duration.
     *
     * @return {Number}
     * @api public
     */

    Backoff.prototype.duration = function(){
      var ms = this.ms * Math.pow(this.factor, this.attempts++);
      if (this.jitter) {
        var rand =  Math.random();
        var deviation = Math.floor(rand * this.jitter * ms);
        ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
      }
      return Math.min(ms, this.max) | 0;
    };

    /**
     * Reset the number of attempts.
     *
     * @api public
     */

    Backoff.prototype.reset = function(){
      this.attempts = 0;
    };

    /**
     * Set the minimum duration
     *
     * @api public
     */

    Backoff.prototype.setMin = function(min){
      this.ms = min;
    };

    /**
     * Set the maximum duration
     *
     * @api public
     */

    Backoff.prototype.setMax = function(max){
      this.max = max;
    };

    /**
     * Set the jitter
     *
     * @api public
     */

    Backoff.prototype.setJitter = function(jitter){
      this.jitter = jitter;
    };

    /**
     * Module dependencies.
     */







    var debug$7 = browser('socket.io-client:manager');



    /**
     * IE6+ hasOwnProperty
     */

    var has = Object.prototype.hasOwnProperty;

    /**
     * Module exports
     */

    var manager = Manager;

    /**
     * `Manager` constructor.
     *
     * @param {String} engine instance or engine uri/opts
     * @param {Object} options
     * @api public
     */

    function Manager (uri, opts) {
      if (!(this instanceof Manager)) return new Manager(uri, opts);
      if (uri && ('object' === typeof uri)) {
        opts = uri;
        uri = undefined;
      }
      opts = opts || {};

      opts.path = opts.path || '/socket.io';
      this.nsps = {};
      this.subs = [];
      this.opts = opts;
      this.reconnection(opts.reconnection !== false);
      this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
      this.reconnectionDelay(opts.reconnectionDelay || 1000);
      this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
      this.randomizationFactor(opts.randomizationFactor || 0.5);
      this.backoff = new backo2({
        min: this.reconnectionDelay(),
        max: this.reconnectionDelayMax(),
        jitter: this.randomizationFactor()
      });
      this.timeout(null == opts.timeout ? 20000 : opts.timeout);
      this.readyState = 'closed';
      this.uri = uri;
      this.connecting = [];
      this.lastPing = null;
      this.encoding = false;
      this.packetBuffer = [];
      var _parser = opts.parser || socket_ioParser;
      this.encoder = new _parser.Encoder();
      this.decoder = new _parser.Decoder();
      this.autoConnect = opts.autoConnect !== false;
      if (this.autoConnect) this.open();
    }

    /**
     * Propagate given event to sockets and emit on `this`
     *
     * @api private
     */

    Manager.prototype.emitAll = function () {
      this.emit.apply(this, arguments);
      for (var nsp in this.nsps) {
        if (has.call(this.nsps, nsp)) {
          this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
        }
      }
    };

    /**
     * Update `socket.id` of all sockets
     *
     * @api private
     */

    Manager.prototype.updateSocketIds = function () {
      for (var nsp in this.nsps) {
        if (has.call(this.nsps, nsp)) {
          this.nsps[nsp].id = this.generateId(nsp);
        }
      }
    };

    /**
     * generate `socket.id` for the given `nsp`
     *
     * @param {String} nsp
     * @return {String}
     * @api private
     */

    Manager.prototype.generateId = function (nsp) {
      return (nsp === '/' ? '' : (nsp + '#')) + this.engine.id;
    };

    /**
     * Mix in `Emitter`.
     */

    componentEmitter$2(Manager.prototype);

    /**
     * Sets the `reconnection` config.
     *
     * @param {Boolean} true/false if it should automatically reconnect
     * @return {Manager} self or value
     * @api public
     */

    Manager.prototype.reconnection = function (v) {
      if (!arguments.length) return this._reconnection;
      this._reconnection = !!v;
      return this;
    };

    /**
     * Sets the reconnection attempts config.
     *
     * @param {Number} max reconnection attempts before giving up
     * @return {Manager} self or value
     * @api public
     */

    Manager.prototype.reconnectionAttempts = function (v) {
      if (!arguments.length) return this._reconnectionAttempts;
      this._reconnectionAttempts = v;
      return this;
    };

    /**
     * Sets the delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */

    Manager.prototype.reconnectionDelay = function (v) {
      if (!arguments.length) return this._reconnectionDelay;
      this._reconnectionDelay = v;
      this.backoff && this.backoff.setMin(v);
      return this;
    };

    Manager.prototype.randomizationFactor = function (v) {
      if (!arguments.length) return this._randomizationFactor;
      this._randomizationFactor = v;
      this.backoff && this.backoff.setJitter(v);
      return this;
    };

    /**
     * Sets the maximum delay between reconnections.
     *
     * @param {Number} delay
     * @return {Manager} self or value
     * @api public
     */

    Manager.prototype.reconnectionDelayMax = function (v) {
      if (!arguments.length) return this._reconnectionDelayMax;
      this._reconnectionDelayMax = v;
      this.backoff && this.backoff.setMax(v);
      return this;
    };

    /**
     * Sets the connection timeout. `false` to disable
     *
     * @return {Manager} self or value
     * @api public
     */

    Manager.prototype.timeout = function (v) {
      if (!arguments.length) return this._timeout;
      this._timeout = v;
      return this;
    };

    /**
     * Starts trying to reconnect if reconnection is enabled and we have not
     * started reconnecting yet
     *
     * @api private
     */

    Manager.prototype.maybeReconnectOnOpen = function () {
      // Only try to reconnect if it's the first time we're connecting
      if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
        // keeps reconnection from firing twice for the same reconnection loop
        this.reconnect();
      }
    };

    /**
     * Sets the current transport `socket`.
     *
     * @param {Function} optional, callback
     * @return {Manager} self
     * @api public
     */

    Manager.prototype.open =
    Manager.prototype.connect = function (fn, opts) {
      debug$7('readyState %s', this.readyState);
      if (~this.readyState.indexOf('open')) return this;

      debug$7('opening %s', this.uri);
      this.engine = lib$1(this.uri, this.opts);
      var socket = this.engine;
      var self = this;
      this.readyState = 'opening';
      this.skipReconnect = false;

      // emit `open`
      var openSub = on_1(socket, 'open', function () {
        self.onopen();
        fn && fn();
      });

      // emit `connect_error`
      var errorSub = on_1(socket, 'error', function (data) {
        debug$7('connect_error');
        self.cleanup();
        self.readyState = 'closed';
        self.emitAll('connect_error', data);
        if (fn) {
          var err = new Error('Connection error');
          err.data = data;
          fn(err);
        } else {
          // Only do this if there is no fn to handle the error
          self.maybeReconnectOnOpen();
        }
      });

      // emit `connect_timeout`
      if (false !== this._timeout) {
        var timeout = this._timeout;
        debug$7('connect attempt will timeout after %d', timeout);

        // set timer
        var timer = setTimeout(function () {
          debug$7('connect attempt timed out after %d', timeout);
          openSub.destroy();
          socket.close();
          socket.emit('error', 'timeout');
          self.emitAll('connect_timeout', timeout);
        }, timeout);

        this.subs.push({
          destroy: function () {
            clearTimeout(timer);
          }
        });
      }

      this.subs.push(openSub);
      this.subs.push(errorSub);

      return this;
    };

    /**
     * Called upon transport open.
     *
     * @api private
     */

    Manager.prototype.onopen = function () {
      debug$7('open');

      // clear old subs
      this.cleanup();

      // mark as open
      this.readyState = 'open';
      this.emit('open');

      // add new subs
      var socket = this.engine;
      this.subs.push(on_1(socket, 'data', componentBind(this, 'ondata')));
      this.subs.push(on_1(socket, 'ping', componentBind(this, 'onping')));
      this.subs.push(on_1(socket, 'pong', componentBind(this, 'onpong')));
      this.subs.push(on_1(socket, 'error', componentBind(this, 'onerror')));
      this.subs.push(on_1(socket, 'close', componentBind(this, 'onclose')));
      this.subs.push(on_1(this.decoder, 'decoded', componentBind(this, 'ondecoded')));
    };

    /**
     * Called upon a ping.
     *
     * @api private
     */

    Manager.prototype.onping = function () {
      this.lastPing = new Date();
      this.emitAll('ping');
    };

    /**
     * Called upon a packet.
     *
     * @api private
     */

    Manager.prototype.onpong = function () {
      this.emitAll('pong', new Date() - this.lastPing);
    };

    /**
     * Called with data.
     *
     * @api private
     */

    Manager.prototype.ondata = function (data) {
      this.decoder.add(data);
    };

    /**
     * Called when parser fully decodes a packet.
     *
     * @api private
     */

    Manager.prototype.ondecoded = function (packet) {
      this.emit('packet', packet);
    };

    /**
     * Called upon socket error.
     *
     * @api private
     */

    Manager.prototype.onerror = function (err) {
      debug$7('error', err);
      this.emitAll('error', err);
    };

    /**
     * Creates a new socket for the given `nsp`.
     *
     * @return {Socket}
     * @api public
     */

    Manager.prototype.socket = function (nsp, opts) {
      var socket = this.nsps[nsp];
      if (!socket) {
        socket = new socket$1(this, nsp, opts);
        this.nsps[nsp] = socket;
        var self = this;
        socket.on('connecting', onConnecting);
        socket.on('connect', function () {
          socket.id = self.generateId(nsp);
        });

        if (this.autoConnect) {
          // manually call here since connecting event is fired before listening
          onConnecting();
        }
      }

      function onConnecting () {
        if (!~indexof(self.connecting, socket)) {
          self.connecting.push(socket);
        }
      }

      return socket;
    };

    /**
     * Called upon a socket close.
     *
     * @param {Socket} socket
     */

    Manager.prototype.destroy = function (socket) {
      var index = indexof(this.connecting, socket);
      if (~index) this.connecting.splice(index, 1);
      if (this.connecting.length) return;

      this.close();
    };

    /**
     * Writes a packet.
     *
     * @param {Object} packet
     * @api private
     */

    Manager.prototype.packet = function (packet) {
      debug$7('writing packet %j', packet);
      var self = this;
      if (packet.query && packet.type === 0) packet.nsp += '?' + packet.query;

      if (!self.encoding) {
        // encode, then write to engine with result
        self.encoding = true;
        this.encoder.encode(packet, function (encodedPackets) {
          for (var i = 0; i < encodedPackets.length; i++) {
            self.engine.write(encodedPackets[i], packet.options);
          }
          self.encoding = false;
          self.processPacketQueue();
        });
      } else { // add packet to the queue
        self.packetBuffer.push(packet);
      }
    };

    /**
     * If packet buffer is non-empty, begins encoding the
     * next packet in line.
     *
     * @api private
     */

    Manager.prototype.processPacketQueue = function () {
      if (this.packetBuffer.length > 0 && !this.encoding) {
        var pack = this.packetBuffer.shift();
        this.packet(pack);
      }
    };

    /**
     * Clean up transport subscriptions and packet buffer.
     *
     * @api private
     */

    Manager.prototype.cleanup = function () {
      debug$7('cleanup');

      var subsLength = this.subs.length;
      for (var i = 0; i < subsLength; i++) {
        var sub = this.subs.shift();
        sub.destroy();
      }

      this.packetBuffer = [];
      this.encoding = false;
      this.lastPing = null;

      this.decoder.destroy();
    };

    /**
     * Close the current socket.
     *
     * @api private
     */

    Manager.prototype.close =
    Manager.prototype.disconnect = function () {
      debug$7('disconnect');
      this.skipReconnect = true;
      this.reconnecting = false;
      if ('opening' === this.readyState) {
        // `onclose` will not fire because
        // an open event never happened
        this.cleanup();
      }
      this.backoff.reset();
      this.readyState = 'closed';
      if (this.engine) this.engine.close();
    };

    /**
     * Called upon engine close.
     *
     * @api private
     */

    Manager.prototype.onclose = function (reason) {
      debug$7('onclose');

      this.cleanup();
      this.backoff.reset();
      this.readyState = 'closed';
      this.emit('close', reason);

      if (this._reconnection && !this.skipReconnect) {
        this.reconnect();
      }
    };

    /**
     * Attempt a reconnection.
     *
     * @api private
     */

    Manager.prototype.reconnect = function () {
      if (this.reconnecting || this.skipReconnect) return this;

      var self = this;

      if (this.backoff.attempts >= this._reconnectionAttempts) {
        debug$7('reconnect failed');
        this.backoff.reset();
        this.emitAll('reconnect_failed');
        this.reconnecting = false;
      } else {
        var delay = this.backoff.duration();
        debug$7('will wait %dms before reconnect attempt', delay);

        this.reconnecting = true;
        var timer = setTimeout(function () {
          if (self.skipReconnect) return;

          debug$7('attempting reconnect');
          self.emitAll('reconnect_attempt', self.backoff.attempts);
          self.emitAll('reconnecting', self.backoff.attempts);

          // check again for the case socket closed in above events
          if (self.skipReconnect) return;

          self.open(function (err) {
            if (err) {
              debug$7('reconnect attempt error');
              self.reconnecting = false;
              self.reconnect();
              self.emitAll('reconnect_error', err.data);
            } else {
              debug$7('reconnect success');
              self.onreconnect();
            }
          });
        }, delay);

        this.subs.push({
          destroy: function () {
            clearTimeout(timer);
          }
        });
      }
    };

    /**
     * Called upon successful reconnect.
     *
     * @api private
     */

    Manager.prototype.onreconnect = function () {
      var attempt = this.backoff.attempts;
      this.reconnecting = false;
      this.backoff.reset();
      this.updateSocketIds();
      this.emitAll('reconnect', attempt);
    };

    var lib$2 = createCommonjsModule(function (module, exports) {
    /**
     * Module dependencies.
     */




    var debug = browser('socket.io-client');

    /**
     * Module exports.
     */

    module.exports = exports = lookup;

    /**
     * Managers cache.
     */

    var cache = exports.managers = {};

    /**
     * Looks up an existing `Manager` for multiplexing.
     * If the user summons:
     *
     *   `io('http://localhost/a');`
     *   `io('http://localhost/b');`
     *
     * We reuse the existing instance based on same scheme/port/host,
     * and we initialize sockets for each namespace.
     *
     * @api public
     */

    function lookup (uri, opts) {
      if (typeof uri === 'object') {
        opts = uri;
        uri = undefined;
      }

      opts = opts || {};

      var parsed = url_1(uri);
      var source = parsed.source;
      var id = parsed.id;
      var path = parsed.path;
      var sameNamespace = cache[id] && path in cache[id].nsps;
      var newConnection = opts.forceNew || opts['force new connection'] ||
                          false === opts.multiplex || sameNamespace;

      var io;

      if (newConnection) {
        debug('ignoring socket cache for %s', source);
        io = manager(source, opts);
      } else {
        if (!cache[id]) {
          debug('new io instance for %s', source);
          cache[id] = manager(source, opts);
        }
        io = cache[id];
      }
      if (parsed.query && !opts.query) {
        opts.query = parsed.query;
      }
      return io.socket(parsed.path, opts);
    }

    /**
     * Protocol version.
     *
     * @api public
     */

    exports.protocol = socket_ioParser.protocol;

    /**
     * `connect`.
     *
     * @param {String} uri
     * @api public
     */

    exports.connect = lookup;

    /**
     * Expose constructors for standalone build.
     *
     * @api public
     */

    exports.Manager = manager;
    exports.Socket = socket$1;
    });

    /* src\pages\index.svelte generated by Svelte v3.27.0 */

    const { console: console_1 } = globals;
    const file$3 = "src\\pages\\index.svelte";

    function create_fragment$4(ctx) {
    	let div0;
    	let h5;
    	let t1;
    	let nav;
    	let a0;
    	let a0_href_value;
    	let t3;
    	let a1;
    	let a1_href_value;
    	let t5;
    	let a2;
    	let a2_href_value;
    	let t7;
    	let div1;
    	let h1;
    	let t9;
    	let p;
    	let t11;
    	let div4;
    	let div3;
    	let div2;
    	let t12;
    	let div5;
    	let footer;
    	let input0;
    	let Scale_action;
    	let t13;
    	let input1;
    	let Upload_action;
    	let t14;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h5 = element("h5");
    			h5.textContent = "Курсач";
    			t1 = space();
    			nav = element("nav");
    			a0 = element("a");
    			a0.textContent = "Кнопка";
    			t3 = space();
    			a1 = element("a");
    			a1.textContent = "Ещё кнопка";
    			t5 = space();
    			a2 = element("a");
    			a2.textContent = "Кнопка";
    			t7 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Описание игры..";
    			t9 = space();
    			p = element("p");
    			p.textContent = "Здесь надо будет что-нибудь написать.";
    			t11 = space();
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			t12 = space();
    			div5 = element("div");
    			footer = element("footer");
    			input0 = element("input");
    			t13 = space();
    			input1 = element("input");
    			t14 = space();
    			button = element("button");
    			button.textContent = "Пикча";
    			attr_dev(h5, "class", "my-0 mr-md-auto font-weight-normal");
    			add_location(h5, file$3, 278, 4, 9671);
    			attr_dev(a0, "class", "p-2 text-dark");
    			attr_dev(a0, "href", a0_href_value = "#");
    			add_location(a0, file$3, 280, 8, 9779);
    			attr_dev(a1, "class", "p-2 text-dark");
    			attr_dev(a1, "href", a1_href_value = "#");
    			add_location(a1, file$3, 281, 8, 9835);
    			attr_dev(nav, "class", "my-2 my-md-0 mr-md-3");
    			add_location(nav, file$3, 279, 4, 9735);
    			attr_dev(a2, "class", "btn btn-outline-primary");
    			attr_dev(a2, "href", a2_href_value = "#");
    			add_location(a2, file$3, 283, 4, 9903);
    			attr_dev(div0, "class", "d-flex flex-column flex-md-row align-items-center p-3 px-md-4 mb-3 bg-white border-bottom shadow-sm");
    			add_location(div0, file$3, 277, 0, 9552);
    			attr_dev(h1, "class", "display-4");
    			add_location(h1, file$3, 287, 4, 10053);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$3, 288, 4, 10101);
    			attr_dev(div1, "class", "pricing-header px-3 py-3 pt-md-5 pb-md-4 mx-auto text-center");
    			add_location(div1, file$3, 286, 0, 9973);
    			add_location(div2, file$3, 293, 8, 10275);
    			attr_dev(div3, "class", "canvas");
    			set_style(div3, "width", /*PIXELS_X*/ ctx[1] + "px");
    			set_style(div3, "height", /*PIXELS_Y*/ ctx[2] + "px");
    			add_location(div3, file$3, 292, 4, 10194);
    			attr_dev(div4, "class", "flex");
    			add_location(div4, file$3, 291, 0, 10170);
    			set_style(input0, "display", "none");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "-0.5");
    			attr_dev(input0, "max", "1");
    			input0.value = "1";
    			attr_dev(input0, "step", "0.01");
    			add_location(input0, file$3, 309, 8, 10668);
    			attr_dev(input1, "name", "img");
    			attr_dev(input1, "id", "imageselect");
    			set_style(input1, "display", "none");
    			attr_dev(input1, "type", "file");
    			attr_dev(input1, "accept", "image/*");
    			add_location(input1, file$3, 310, 2, 10755);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn btn-danger");
    			add_location(button, file$3, 311, 8, 10864);
    			attr_dev(footer, "class", "pt-4 my-md-5 pt-md-5 border-top");
    			add_location(footer, file$3, 308, 4, 10610);
    			attr_dev(div5, "class", "container");
    			add_location(div5, file$3, 297, 0, 10331);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h5);
    			append_dev(div0, t1);
    			append_dev(div0, nav);
    			append_dev(nav, a0);
    			append_dev(nav, t3);
    			append_dev(nav, a1);
    			append_dev(div0, t5);
    			append_dev(div0, a2);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h1);
    			append_dev(div1, t9);
    			append_dev(div1, p);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			/*div2_binding*/ ctx[5](div2);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, footer);
    			append_dev(footer, input0);
    			append_dev(footer, t13);
    			append_dev(footer, input1);
    			append_dev(footer, t14);
    			append_dev(footer, button);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(Scale_action = /*Scale*/ ctx[4].call(null, input0)),
    					action_destroyer(Upload_action = /*Upload*/ ctx[3].call(null, input1)),
    					listen_dev(button, "click", /*click_handler*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div4);
    			/*div2_binding*/ ctx[5](null);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(div5);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Pages", slots, []);

    	let canvas,
    		stage,
    		layer,
    		counter = 0,
    		MWIDTH = 10,
    		MHEIGHT = 10,
    		SIDE = 72,
    		PIXELS_X = MWIDTH * SIDE,
    		PIXELS_Y = MHEIGHT * SIDE,
    		socket;

    	// Показывает уведомление
    	window.notify = function (title, message = " ", color = "") {
    		iziToast.show({ title, message, timeout: 5000, color });
    	};

    	// Событие, когда готова разметка страницы
    	onMount(() => {
    		// Создание сцены и слоя
    		stage = new lib.Stage({
    				container: canvas,
    				width: PIXELS_X,
    				height: PIXELS_Y,
    				draggable: false
    			});

    		layer = new lib.Layer();
    		stage.add(layer);

    		// Установка изображения
    		SetImage("http://litcult.ru/u/dd/lyrics/64689/foto.jpg");
    	}); // Подключение к серверу
    	// socket = io('localhost');
    	// socket.on('connect', () => {
    	//     console.log('connected!');

    	//     socket.emit('select', 1);
    	// });
    	// Получает индекс по позиции
    	const GetIndexAt = pos => {
    		if (pos.x < 0 || pos.y < 0 || pos.x > MWIDTH * SIDE || pos.y > MHEIGHT * SIDE) {
    			return -1;
    		} else {
    			let ox = parseInt(pos.x / SIDE);
    			let oy = parseInt(pos.y / SIDE);
    			return oy * MWIDTH + ox;
    		}
    	};

    	// Случайное число в диапазоне
    	const GetRandomNumber = (min, max) => {
    		min = Math.ceil(min);
    		max = Math.floor(max);
    		return Math.floor(Math.random() * (max - min + 1)) + min;
    	};

    	// Перемешивает массив
    	const Shuffle = a => {
    		for (let i = a.length - 1; i > 0; i--) {
    			const j = Math.floor(Math.random() * (i + 1));
    			[a[i], a[j]] = [a[j], a[i]];
    		}

    		return a;
    	};

    	// Устанавливает картинку
    	const SetImage = url => {
    		counter = 0;
    		layer.destroyChildren();
    		console.log(url);
    		let img = new Image();
    		img.src = url;

    		img.onload = function () {
    			// PIXELS_X = this.width;
    			// PIXELS_Y = this.height;
    			// Массив из случайных чисел
    			let r = Shuffle(Array.from(Array(MHEIGHT * MWIDTH).keys()));

    			// MWIDTH * MWIDTH - квадрат
    			for (let i = 0; i < MWIDTH; i++) {
    				for (let j = 0; j < MWIDTH; j++) {
    					let id = i * MWIDTH + j;

    					let pic = new lib.Image({
    							image: img,
    							id: id.toString(),
    							x: j * SIDE,
    							y: i * SIDE,
    							width: SIDE,
    							height: SIDE,
    							crop: {
    								x: j * SIDE,
    								y: i * SIDE,
    								width: SIDE,
    								height: SIDE
    							},
    							draggable: true,
    							dragBoundFunc(pos) {
    								return {
    									x: pos.x < 0
    									? 0
    									: pos.x + SIDE >= PIXELS_X ? PIXELS_X - SIDE : pos.x,
    									y: pos.y < 0
    									? 0
    									: pos.y + SIDE >= PIXELS_Y ? PIXELS_Y - SIDE : pos.y
    								};
    							}
    						});

    					pic.on("click", function () {
    						if (pic.getAttr("drag") === false) notify("", "Плитка " + pic.getAttr("init") + " установлена правильно.", "green"); else notify("Плитка: " + pic.getAttr("init"), "Переместите её на нужное место мышкой.", "blue");
    					});

    					// Картинка взята мышкой - выдвигаем её наверх
    					pic.on("dragstart", function () {
    						pic.moveToTop();
    					});

    					// Картинка отпущена - по позиции курсора ищем её новый индекс
    					pic.on("dragend", function () {
    						let destination = GetIndexAt(stage.getPointerPosition());
    						ChangeTileIndex(pic, destination);
    						layer.draw();
    					});

    					// Изначальные атрибуты картинки
    					pic.setAttrs({
    						"drag": true, // картинку можно перетаскивать
    						"init": id, // изначальный индекс, если он совпал с now - картинка стоит на своём месте
    						"now": r[id], // текущий индекс, от 0 до MHEIGHT*MWIDTH+MWIDTH
    						
    					});

    					// Добавление на слой, обновление свойств
    					layer.add(pic);

    					UpdateTile(pic, 2, false);
    				}
    			}

    			layer.batchDraw();
    		};
    	};

    	// Проверяет, существует ли такой индекс
    	const IsValidIndex = index => 0 <= index && index < MHEIGHT * MWIDTH;

    	// Обновляет картинку
    	const UpdateTile = (tile, duration = 0.1, say = false) => {
    		// Получаем текущий индекс и двигаем туда картинку с анимацией
    		let index = tile.getAttr("now");

    		tile.to({ x: GetX(index), y: GetY(index), duration });

    		// Если совпал индекс и изначальный индекс, картинка стоит правильно, запрещаем двигать
    		if (index === tile.getAttr("init")) {
    			tile.draggable(false);

    			if (tile.getAttr("drag") === true) {
    				if (say) notify("Ура!", "Плитка " + index + " установлена правильно.", "green");
    				counter++;
    			}

    			tile.setAttr("drag", false);
    		}

    		if (counter === MWIDTH * MWIDTH) {
    			iziToast.show({
    				theme: "dark",
    				title: "Поздравляем",
    				message: "Вы собрали пазл!",
    				duration: 15000,
    				position: "center"
    			});
    		}
    	};

    	// Получает картинку на индексе
    	const GetTileAtIndex = index => {
    		let kids = layer.getChildren();
    		for (let i = 0; i < kids.length; i++) if (kids[i].getAttr("now") === index) return kids[i];
    		return null;
    	};

    	// Изменение индекса картинки
    	const ChangeTileIndex = (tile, where) => {
    		// Получение картинки на том месте, куда хотим переместить
    		let tile2 = GetTileAtIndex(where);

    		if (tile.getAttr("drag") === false) ; else // Мы ничего не делаем и просто возвращаем её на своё место
    		if (!IsValidIndex(where)) {
    			// Это вызывается, если пользователь ведёт мышкой за пределами таблицы
    			console.log("Неправильный индекс!"); // Если каким-то образом пользователь переместил плитку, которую перемещать нельзя
    		} else if (!tile2) {
    			// На нужном нам месте пусто - туда можно переместить
    			tile.setAttr("now", where);

    			UpdateTile(tile, 0.5, true);
    		} else if (tile2.getAttr("drag") === true) {
    			// Меняем местами атрибуты, если вторую картинку можно передвигать, т.е. она стоит неправильно
    			tile2.setAttr("now", tile.getAttr("now"));

    			tile.setAttr("now", where);
    			UpdateTile(tile2, 0.5, true);
    		} else notify("Плитка уже установлена правильно!", "Её позицию нельзя занять.");

    		// В любом случае, обновляем картинку - она либо заняла новый индекс, либо вернулась на свой
    		UpdateTile(tile, 0.5, true);
    	};

    	// Получение X и Y в пикселях по индексу
    	const GetX = index => index % MWIDTH * SIDE;

    	const GetY = index => Math.floor(index / MWIDTH) * SIDE;

    	// Загрузка фото
    	const Upload = node => {
    		node.onchange2 = function () {
    			let file = node.files[0];
    			let url = "https://api.cloudinary.com/v1_1/demo/upload";
    			let xhr = new XMLHttpRequest();
    			let fd = new FormData();
    			xhr.open("POST", url, true);
    			xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

    			xhr.upload.addEventListener("progress", function (e) {
    				console.log("Пикча (" + Math.round(e.loaded * 100 / e.total) + " %)");
    			});

    			xhr.onreadystatechange = function (e) {
    				if (xhr.readyState == 4 && xhr.status == 200) {
    					var response = JSON.parse(xhr.responseText);
    					console.log(response);
    					var url = response.secure_url;
    					console.log(url);
    				} else {
    					console.log("Error");
    					console.log(xhr.status);
    					console.log(xhr.readyState);
    				}
    			};

    			fd.append("upload_preset", "doc_codepen_example");
    			fd.append("tags", "browser_upload"); // Optional - add tag for image admin in Cloudinary
    			fd.append("file", file);
    			xhr.send(fd);
    		};

    		node.onchange = function () {
    			let file = node.files[0];
    			let reader = new FileReader();

    			reader.onload = function (e) {
    				SetImage(e.target.result);
    			};

    			reader.readAsDataURL(file);
    		};
    	};

    	// Масштабирование сцены (для отладки)
    	const Scale = node => {
    		node.oninput = function () {
    			console.log(node.value);
    			stage.scale({ x: node.value, y: node.value });
    			stage.batchDraw();
    		};
    	};

    	window.auto = (from, where) => {
    		let tile = GetTileAtIndex(from);

    		if (tile) {
    			ChangeTileIndex(tile, where);
    			return "OK";
    		} else {
    			return "Нет картинки с ID: " + from;
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Pages> was created with unknown prop '${key}'`);
    	});

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			canvas = $$value;
    			$$invalidate(0, canvas);
    		});
    	}

    	const click_handler = () => document.getElementById("imageselect").click();

    	$$self.$capture_state = () => ({
    		onMount,
    		Konva: lib,
    		io: lib$2,
    		canvas,
    		stage,
    		layer,
    		counter,
    		MWIDTH,
    		MHEIGHT,
    		SIDE,
    		PIXELS_X,
    		PIXELS_Y,
    		socket,
    		GetIndexAt,
    		GetRandomNumber,
    		Shuffle,
    		SetImage,
    		IsValidIndex,
    		UpdateTile,
    		GetTileAtIndex,
    		ChangeTileIndex,
    		GetX,
    		GetY,
    		Upload,
    		Scale
    	});

    	$$self.$inject_state = $$props => {
    		if ("canvas" in $$props) $$invalidate(0, canvas = $$props.canvas);
    		if ("stage" in $$props) stage = $$props.stage;
    		if ("layer" in $$props) layer = $$props.layer;
    		if ("counter" in $$props) counter = $$props.counter;
    		if ("MWIDTH" in $$props) MWIDTH = $$props.MWIDTH;
    		if ("MHEIGHT" in $$props) MHEIGHT = $$props.MHEIGHT;
    		if ("SIDE" in $$props) SIDE = $$props.SIDE;
    		if ("PIXELS_X" in $$props) $$invalidate(1, PIXELS_X = $$props.PIXELS_X);
    		if ("PIXELS_Y" in $$props) $$invalidate(2, PIXELS_Y = $$props.PIXELS_Y);
    		if ("socket" in $$props) socket = $$props.socket;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [canvas, PIXELS_X, PIXELS_Y, Upload, Scale, div2_binding, click_handler];
    }

    class Pages extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pages",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    //tree
    const _tree = {
      "name": "root",
      "filepath": "/",
      "root": true,
      "ownMeta": {},
      "absolutePath": "src/pages",
      "children": [
        {
          "isFile": true,
          "isDir": false,
          "file": "about.svelte",
          "filepath": "/about.svelte",
          "name": "about",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "D:/Code/Node/Puzzle/src/pages/about.svelte",
          "importPath": "../../../../src/pages/about.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": false,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "preload": false,
            "prerender": true,
            "precache-order": false,
            "precache-proximity": true,
            "recursive": true
          },
          "path": "/about",
          "id": "_about",
          "component": () => About
        },
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "D:/Code/Node/Puzzle/src/pages/index.svelte",
          "importPath": "../../../../src/pages/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "preload": false,
            "prerender": true,
            "precache-order": false,
            "precache-proximity": true,
            "recursive": true
          },
          "path": "/index",
          "id": "_index",
          "component": () => Pages
        }
      ],
      "isLayout": false,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "meta": {
        "preload": false,
        "prerender": true,
        "precache-order": false,
        "precache-proximity": true,
        "recursive": true
      },
      "path": "/"
    };


    const {tree, routes: routes$1} = buildClientTree(_tree);

    /* src\App.svelte generated by Svelte v3.27.0 */

    function create_fragment$5(ctx) {
    	let router;
    	let current;
    	router = new Router({ props: { routes: routes$1 }, $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Router, routes: routes$1 });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const app = HMR(App, { target: document.body }, 'routify-app');

    return app;

}());
//# sourceMappingURL=bundle.js.map
