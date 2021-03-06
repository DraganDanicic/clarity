/*
 * Copyright (c) 2016-2018 VMware, Inc. All Rights Reserved.
 * This software is released under MIT license.
 * The full license information can be found in LICENSE in the root directory of this project.
 */
import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, Output, QueryList } from '@angular/core';
import { Subscription } from 'rxjs';

import { Expand } from '../../utils/expand/providers/expand';
import { LoadingListener } from '../../utils/loading/loading-listener';

import { ClrDatagridCell } from './datagrid-cell';
import { DatagridHideableColumnModel } from './datagrid-hideable-column.model';
import { ExpandableRowsCount } from './providers/global-expandable-rows';
import { HideableColumnService } from './providers/hideable-column.service';
import { RowActionService } from './providers/row-action-service';
import { Selection, SelectionType } from './providers/selection';
import { ClrCommonStrings } from '../../utils/i18n';

let nbRow: number = 0;

@Component({
  selector: 'clr-dg-row',
  template: `
    <!--
      We need to wrap the #rowContent in label element if we are in rowSelectionMode.
      Clicking of that wrapper label will equate to clicking on the whole row, which triggers the checkbox to toggle.
    -->
    <label class="datagrid-row-clickable" *ngIf="selection.rowSelectionMode">
      <ng-template [ngTemplateOutlet]="rowContent"></ng-template>
    </label>
    
    <ng-template *ngIf="!selection.rowSelectionMode" [ngTemplateOutlet]="rowContent"></ng-template>
    
    <ng-template *ngIf="!expand.replace && expand.expanded && !expand.loading"
                 [ngTemplateOutlet]="detail"></ng-template>
    <!-- 
        We need the "project into template" hack because we need this in 2 different places
        depending on whether the details replace the row or not.
    -->
    <ng-template #detail>
        <ng-content select="clr-dg-row-detail"></ng-content>
    </ng-template>

    <ng-template #rowContent>
      <div role="row" [id]="id" class="datagrid-row-master datagrid-row-flex">
        <clr-dg-cell *ngIf="selection.selectionType === SELECTION_TYPE.Multi"
                     class="datagrid-select datagrid-fixed-column">
          <input clrCheckbox type="checkbox" [ngModel]="selected" (ngModelChange)="toggle($event)"
            [attr.aria-label]="commonStrings.select">
        </clr-dg-cell>
        <clr-dg-cell *ngIf="selection.selectionType === SELECTION_TYPE.Single"
                     class="datagrid-select datagrid-fixed-column">
          <div class="radio">
            <!-- TODO: it would be better if in addition to the generic "Select" label, we could add aria-labelledby
            to label the radio by the first cell in the row (typically an id or name).
             It's pretty easy to label it with the whole row since we already have an id for it, but in most
             cases the row is far too long to serve as a label, the screenreader reads every single cell content. -->
            <input type="radio" [id]="radioId" [name]="selection.id + '-radio'" [value]="item"
                   [(ngModel)]="selection.currentSingle" [checked]="selection.currentSingle === item"
                   [attr.aria-label]="commonStrings.select">
            <label for="{{radioId}}"></label>
          </div>
        </clr-dg-cell>
        <clr-dg-cell *ngIf="rowActionService.hasActionableRow"
                     class="datagrid-row-actions datagrid-fixed-column">
          <ng-content select="clr-dg-action-overflow"></ng-content>
        </clr-dg-cell>
        <clr-dg-cell *ngIf="globalExpandable.hasExpandableRow"
                     class="datagrid-expandable-caret datagrid-fixed-column">
          <ng-container *ngIf="expand.expandable">
            <button (click)="toggleExpand()" *ngIf="!expand.loading" type="button" class="datagrid-expandable-caret-button">
              <clr-icon shape="caret" 
                class="datagrid-expandable-caret-icon"
                [attr.dir]="expand.expanded ? 'down' : 'right'"
                [attr.title]="expand.expanded ? commonStrings.collapse : commonStrings.expand"></clr-icon>
            </button>
            <div class="spinner spinner-sm" *ngIf="expand.loading"></div>
          </ng-container>
        </clr-dg-cell>
        <ng-content *ngIf="!expand.replace || !expand.expanded || expand.loading"></ng-content>

        <ng-template *ngIf="expand.replace && expand.expanded && !expand.loading"
                     [ngTemplateOutlet]="detail"></ng-template>
      </div>
    </ng-template>

    `,
  host: {
    '[class.datagrid-row]': 'true',
    '[class.datagrid-selected]': 'selected',
    '[attr.aria-owns]': 'id',
    role: 'rowgroup',
  },
  providers: [Expand, { provide: LoadingListener, useExisting: Expand }],
})
export class ClrDatagridRow<T = any> implements AfterContentInit {
  public id: string;
  public radioId: string;

  /* reference to the enum so that template can access */
  public SELECTION_TYPE = SelectionType;

  /**
   * Model of the row, to use for selection
   */
  @Input('clrDgItem') item: T;

  constructor(
    public selection: Selection<T>,
    public rowActionService: RowActionService,
    public globalExpandable: ExpandableRowsCount,
    public expand: Expand,
    public hideableColumnService: HideableColumnService,
    public commonStrings: ClrCommonStrings
  ) {
    this.id = 'clr-dg-row' + nbRow++;
    this.radioId = 'clr-dg-row-rd' + nbRow++;
  }

  private _selected = false;
  /**
   * Indicates if the row is selected
   */
  public get selected() {
    if (this.selection.selectionType === SelectionType.None) {
      return this._selected;
    } else {
      return this.selection.isSelected(this.item);
    }
  }

  @Input('clrDgSelected')
  public set selected(value: boolean) {
    if (this.selection.selectionType === SelectionType.None) {
      this._selected = value;
    } else {
      this.selection.setSelected(this.item, value);
    }
  }

  @Output('clrDgSelectedChange') selectedChanged = new EventEmitter<boolean>(false);

  public toggle(selected = !this.selected) {
    if (selected !== this.selected) {
      this.selected = selected;
      this.selectedChanged.emit(selected);
    }
  }

  public get expanded() {
    return this.expand.expanded;
  }

  @Input('clrDgExpanded')
  public set expanded(value: boolean) {
    this.expand.expanded = value;
  }

  @Output('clrDgExpandedChange') expandedChange = new EventEmitter<boolean>(false);

  public toggleExpand() {
    if (this.expand.expandable) {
      this.expanded = !this.expanded;
      this.expandedChange.emit(this.expanded);
    }
  }

  private subscription: Subscription;

  /*****
   * property dgCells
   *
   * @description
   * A Query List of the ClrDatagrid cells in this row.
   *
   */
  @ContentChildren(ClrDatagridCell) dgCells: QueryList<ClrDatagridCell>;

  ngAfterContentInit() {
    // Make sure things get started
    const columnsList = this.hideableColumnService.getColumns();
    this.updateCellsForColumns(columnsList);

    // Triggered when the Cells list changes per row-renderer
    this.dgCells.changes.subscribe(cellList => {
      const columnList = this.hideableColumnService.getColumns();
      if (cellList.length === columnList.length) {
        this.updateCellsForColumns(columnList);
      }
    });

    // Used to set things up the first time but only after all the columns are ready.
    this.subscription = this.hideableColumnService.columnListChange.subscribe(columnList => {
      // Prevents cell updates when cols and cells array are not aligned - only seems to run on init / first time.
      if (columnList.length === this.dgCells.length) {
        this.updateCellsForColumns(columnList);
      }
    });
  }

  /**********
   *
   * @description
   * 1. Maps the new columnListChange to the dgCells list by index
   * 2. Sets the hidden state on the cell
   * Take a Column list and use index to access the columns for hideable properties.
   *
   */
  public updateCellsForColumns(columnList: DatagridHideableColumnModel[]) {
    // Map cells to columns with Array.index
    this.dgCells.forEach((cell, index) => {
      const currentColumn = columnList[index]; // Accounts for null space.
      if (currentColumn) {
        cell.id = currentColumn.id;
      }
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
