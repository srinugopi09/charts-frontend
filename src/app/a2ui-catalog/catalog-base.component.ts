import { DynamicComponent } from '@a2ui/angular';

/**
 * Base class for all A2UI catalog components.
 *
 * Provides the shared getProp() helper for accessing properties from
 * the A2UI component signal (component().properties).
 *
 * CRITICAL: DynamicComponent stores props in component().properties,
 * NOT as class properties on the instance.
 */
export abstract class CatalogBaseComponent extends DynamicComponent {
  protected getProp<T>(key: string, defaultValue?: T): T | undefined {
    const props: any = this.component().properties;
    return props[key] !== undefined ? props[key] : defaultValue;
  }
}
