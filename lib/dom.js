(function(global, document, define){
    define(["has/bugs", "has/dom"], function(has){
        if(!has("dom")){ return {}; }

        var byId, getNodeName, destroyElement, destroyDescendants;

        has.add("dom-innerhtml", function(g, d, e){
            var supported = false;
            try{
                e.innerHTML = '<p><\/p>';
                supported = !!e.firstChild && e.firstChild.nodeName.toUpperCase() == "P";
                e.innerHTML = '';
            }catch(e){}
            return supported;
        });

        has.add("dom-uniquenumber", function(g, d, e){
            var docEl = d.documentElement;
            return (typeof e.uniqueNumber == 'number' && typeof docEl.uniqueNumber == 'number' &&
                e.uniqueNumber != docEl.uniqueNumber);
        });

        has.add("dom-parentelement", function(g, d, e){
            var docEl = document.documentElement,
                supported = false;
            try{
                docEl.appendChild(e);
                supported = has.isHostType(e, "parentElement");
                docEl.removeChild(e);
            }catch(e){}
            return supported;
        });

        has.add("jscript", function(g){
            var supported = false;

            if(typeof g.ScriptEngineMajorVersion != "undefined" && typeof g.ScriptEngineMinorVersion != "undefined"){
                supported = parseFloat(ScriptEngineMajorVersion() + "." + ScriptEngineMinorVersion());
            }

            return supported;
        });

        function getDocument(element){
            // based on work by John-David Dalton
            return element.ownerDocument || element.document ||
                (element.nodeType == 9 ? element : document);
        }

        function getWindow(element){
            // based on work by Diego Perini and John-David Dalton
            var frame, i = -1, doc = getDocument(element), frames = global.frames;
            if(document != doc){
                while((frame = frames[++i])){
                    if(frame.document == doc){
                        return frame;
                    }
                }
            }
            return global;
        }

        function testId(el, id, iht /* isHostType */){
            return ((iht(el, "attributes") && typeof el.attributes.id != "undefined" && el.attributes.id.value == id) || el.id == id);
        }

        if(has("bug-getelementbyid-ids-names")||has("bug-getelementbyid-ignores-case")){
            byId = function byId(id, doc){
                var _d = doc || document,
                    te = _d.getElementById(id),
                    isHostType = has.isHostType,
                    elems, i;
                // attributes.id.value is better than just id in case the 
                // user has a name=id inside a form
                if(te && testId(te, id, isHostType)){
                    return te;
                }else{
                    elems = _d.all[id];
                    if(!elems || elems.nodeName){
                        elems = [elems];
                    }
                    // if more than 1, choose first with the correct id
                    i = 0;
                    while((te = elems[i++])){
                        if(testId(te, id, isHostType)){
                            return te;
                        }
                    }
                }
                return null;
            };
        }else{
            byId = function byId(id, doc){
                return (doc||document).getElementById(id);
            };
        }

        var NUMBER_PROP = has("dom-uniquenumber") ? "uniqueNumber" : "_uberId",
            _nextNodeId = 2;

        function getNodeId(node){
            // Based on work by John-David Dalton in FuseJS
            var id = node[NUMBER_PROP], win;

            if(!id){
                // In IE window == document is true but not document == window.
                // Use loose comparison because different `window` references for
                // the same window may not strictly equal each other.
                win = getWindow(node);
                if (node == win) {
                    id = node == global ? '0' : getNodeId(node.frameElement) + '-0';
                }else if(node.nodeType == 9){ // document node
                    // quick return for common case OR
                    // calculate id for foreign document objects
                    id = node == document ? '1' : getNodeId(win.frameElement) + '-1';
                }else{
                    id = node._uberId = _nextNodeId++;
                }
            }

            return id;
        }

        var PARENT_PROP = has("dom-parentelement") ? "parentElement" : "parentNode";
        function getParentNode(node){
            return node[PARENT_PROP];
        }

        function isDescendant(node, ancestor){
            try{
                while(node){
                    if(node === ancestor){
                        return true;
                    }
                    node = getParentNode(node);
                }
            }catch(e){}
            return false;
        }

        if(has("dom-tagname-uppercase")){
            getNodeName = function getNodeName(node){
                return node.nodeName;
            };
        }else{
            getNodeName = function getNodeName(node){
                return node.nodeName.toUpperCase();
            };
        }

        var destroyElementData, destroyDescendantData;
        if(has("jscript") && has("jscript") <= 5.7){
            destroyElementData = function(element, recurse){
                var id = getNodeId(element),
                    data = __event_cache__[id],
                    evtData, key;

                if(data){
                    // This is to keep element out of a closure using forIn
                    for(key in data){
                        delete data[key];
                    }
                }
                if(recurse){
                    destroyDescendantData(element);
                }
                delete __event_cache__[id];
            };
            destroyDescendantData = function(element){
                var elements = element.getElementsByTagName("*"),
                    i = elements.length;

                while(i--){
                    element = elements[i];
                    if(element.nodeType == 1){ // ELEMENT_NODE
                        destroyElementData(element, false);
                    }
                }
            };
        }

        // Adapted from FuseJS
        if(has("dom-innerhtml")){
            // Prevent leaks using removeChild
            destroyElement = (function(){
                var trash = document.createElement('div');
                function destroyElement(element){
                    trash.appendChild(element);
                    trash.innerHTML = '';
                    destroyElementData && destroyElementData(element, true);
                }
                return destroyElement;
            })();
            destroyDescendants = function destroyDescendants(element){
                element.innerHTML = '';
                destroyDescendantData && destroyDescendantData(element);
            };
        }else{
            destroyElement = function destroyElement(element, parentNode){
                parentNode = parentNode || getParentNode(element);
                if(parentNode){
                    parentNode.removeChild(element);
                }
                destroyElementData && destroyElementData(element, true);
            };
            destroyDescendants = function destroyDescendants(element){
                var child, de = destroyElement;
                while((child = element.lastChild)){
                    de(child, element);
                }
                destroyDescendantData && destroyDescendantData(element);
            };
        }

        function insertBefore(node, refNode){
            var parent = getParentNode(refNode);
            if(parent){
                parent.insertBefore(node, refNode);
            }
            return node;
        }

        function insertAfter(node, refNode){
            var parent = getParentNode(refNode);
            if(parent){
                parent.insertBefore(node, refNode.nextSibling);
            }
            return node;
        }

        function insertFirst(node, newParent){
            newParent.insertBefore(node, newParent.firstChild);
            return node;
        }

        function insertOnly(node, newParent){
            destroyDescendants(newParent);
            newParent.appendChild(node);
            return node;
        }

        function replaceNode(node, refNode){
            var parent = getParentNode(refNode);
            if(parent){
                parent.replaceChild(node, refNode);
            }
            return node;
        }

        function insertAtIndex(node, newParent, index){
            var cn = newParent.childNodes,
                l = cn.length,
                n = +index,
                refNode;

            n = isNaN(n) ? 0 : n;

            if(l > 0 && n < l){
                if(n<0){
                    n = l + n;
                    n = n < 0 ? 0 : n;
                }
                refNode = cn[n];
            }
            newParent.insertBefore(node, refNode);
            return node;
        }

        return {
            getWindow: getWindow,
            getDocument: getDocument,
            byId: byId,
            isDescendant: isDescendant,
            getNodeId: getNodeId,
            getParentNode: getParentNode,
            getNodeName: getNodeName,
            destroyElement: destroyElement,
            destroyDescendants: destroyDescendants,

            insertBefore: insertBefore,
            insertAfter: insertAfter,
            insertFirst: insertFirst,
            insertOnly: insertOnly,
            replaceNode: replaceNode,
            insertAtIndex: insertAtIndex
        };
    });
})(this, document, typeof define != "undefined" ? define : function(deps, factory){
    this.uber_dom = factory(has); // use global has
});
