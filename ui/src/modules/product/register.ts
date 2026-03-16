import React from 'react';
import { Package } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { ProductPanel } from './components/ProductPanel';
import { ProductOverviewView } from './views/ProductOverviewView';

export function registerProductModule() {
  tabRegistry.registerModule({
    id: 'product',
    label: 'Product',
    icon: Package,
    panelComponent: ProductPanel,
    tabDefinitions: [
      {
        type: 'product-overview',
        renderContent: (tab) => React.createElement(ProductOverviewView, { tab }),
      },
    ],
  });
}
