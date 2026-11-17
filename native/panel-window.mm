#import <AppKit/AppKit.h>
#include <node_api.h>
#include <string.h>

// Electron exposes an NSView pointer, not an NSWindow pointer. This module only
// operates on windows owned by this process and uses public AppKit APIs.
static NSWindow *GetWindow(napi_env env, napi_callback_info info) {
  if (![NSThread isMainThread]) {
    napi_throw_error(env, nullptr, "Panel operations must run on the main thread");
    return nil;
  }
  size_t argc = 1;
  napi_value argv[1];
  bool buffer = false;
  void *data = nullptr;
  size_t length = 0;
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (argc != 1 || napi_is_buffer(env, argv[0], &buffer) != napi_ok || !buffer ||
      napi_get_buffer_info(env, argv[0], &data, &length) != napi_ok || length != sizeof(void *)) {
    napi_throw_type_error(env, nullptr, "Expected a native window handle Buffer");
    return nil;
  }
  void *pointer = nullptr;
  memcpy(&pointer, data, sizeof(pointer));
  // Compare handles without dereferencing arbitrary or stale pointers.
  for (NSWindow *window in NSApp.windows) {
    if ((__bridge void *)window.contentView == pointer) return window;
  }
  napi_throw_error(env, nullptr, "Native window handle is no longer valid");
  return nil;
}

static napi_value Prepare(napi_env env, napi_callback_info info) {
  NSWindow *window = GetWindow(env, info);
  if (!window) return nullptr;
  NSWindowCollectionBehavior behavior = window.collectionBehavior;
  // A utility overlay must not be treated as a normal managed application
  // window. FullScreenAuxiliary alone does not opt into other apps' sets.
  behavior &= ~(NSWindowCollectionBehaviorManaged | NSWindowCollectionBehaviorStationary |
                NSWindowCollectionBehaviorMoveToActiveSpace | NSWindowCollectionBehaviorFullScreenPrimary |
                NSWindowCollectionBehaviorFullScreenNone);
  behavior |= NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorTransient |
              NSWindowCollectionBehaviorFullScreenAuxiliary;
  if (@available(macOS 13.0, *)) {
    behavior &= ~(NSWindowCollectionBehaviorPrimary | NSWindowCollectionBehaviorAuxiliary);
    behavior |= NSWindowCollectionBehaviorCanJoinAllApplications;
  }
  window.collectionBehavior = behavior;
  window.hidesOnDeactivate = NO;
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

static void SetBool(napi_env env, napi_value object, const char *name, bool flag) {
  napi_value value;
  napi_get_boolean(env, flag, &value);
  napi_set_named_property(env, object, name, value);
}

static napi_value Inspect(napi_env env, napi_callback_info info) {
  NSWindow *window = GetWindow(env, info);
  if (!window) return nullptr;
  napi_value result, level;
  napi_create_object(env, &result);
  SetBool(env, result, "visible", window.visible);
  SetBool(env, result, "onActiveSpace", window.onActiveSpace);
  SetBool(env, result, "transient", window.collectionBehavior & NSWindowCollectionBehaviorTransient);
  bool joinsApplications = false;
  if (@available(macOS 13.0, *)) {
    joinsApplications = window.collectionBehavior & NSWindowCollectionBehaviorCanJoinAllApplications;
  }
  SetBool(env, result, "joinsAllApplications", joinsApplications);
  napi_create_int64(env, window.level, &level);
  napi_set_named_property(env, result, "level", level);
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
    {"prepare", nullptr, Prepare, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"inspect", nullptr, Inspect, nullptr, nullptr, nullptr, napi_default, nullptr}
  };
  napi_define_properties(env, exports, 2, properties);
  return exports;
}

NAPI_MODULE(panel_window, Init)
