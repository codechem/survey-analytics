import { Event } from "survey-core";
import { VisualizerBase } from "./visualizerBase";
import { SelectBase } from "./selectBase";
import { ToolbarHelper } from "./utils/index";
import { localization } from "./localizationManager";
import { IVisualizerPanelElement, ElementVisibility } from "./config";
import { VisualizerFactory } from './visualizerFactory';
const Muuri = require("muuri");
import "./visualizationPanel.scss";

const questionElementClassName = "sa-question";
const questionLayoutedElementClassName = "sa-question-layouted";

/**
 * VisualizationPanel is responsible for displaying an array of survey questions
 * questions - an array of survey questions to visualize
 * data - an array of answers in format of survey result
 * options:
 * allowDynamicLayout - set it to false to disable items drag/drop reordering and dynamic layouting
 * allowHideQuestions - set it to false to deny user to hide/show individual questions
 * elements - list of visual element descriptions
 */
export class VisualizationPanel extends VisualizerBase {
  protected filteredData: Array<{ [index: string]: any }>;
  protected filterValues: { [index: string]: any } = {};
  protected visualizers: Array<VisualizerBase> = [];

  constructor(
    protected questions: Array<any>,
    data: Array<{ [index: string]: any }>,
    options: { [index: string]: any } = {},
    private _elements: Array<IVisualizerPanelElement> = [],
    private isTrustedAccess = false
  ) {
    super(null, data, options);
    this.filteredData = data;
    if (_elements.length === 0) {
      this._elements = this.buildElements(questions);
    }
    this.showHeader = false;
    this.registerToolbarItem(
      "resetFilter",
      () => {
        return ToolbarHelper.createButton(
          () => {
            this.visualizers.forEach((visualizer) => {
              if (visualizer instanceof SelectBase) {
                visualizer.setSelection(undefined);
              }
            });
          },
          localization.getString("resetFilter")
        );
      }
    );
    this.registerToolbarItem(
      "addElement",
      (toolbar: HTMLDivElement) => {
        if (this.allowHideQuestions) {
          let addElementSelector: HTMLElement = undefined;
          const addElementSelectorUpdater = (panel: VisualizationPanel, _: any) => {
            const hiddenElements = this.hiddenElements;
            if (hiddenElements.length > 0) {
              const selectWrapper = ToolbarHelper.createSelector(
                [
                  <any>{
                    name: undefined,
                    displayName: localization.getString("addElement"),
                  },
                ]
                  .concat(hiddenElements)
                  .map((element) => {
                    return {
                      value: element.name,
                      text: element.displayName,
                    };
                  }),
                (option: any) => false,
                (e: any) => {
                  var element = this.getElement(e.target.value);
                  element.visibility = ElementVisibility.Visible;
                  const questionElement = this.renderVisualizer(element);
                  this.contentContainer.appendChild(questionElement);
                  !!this.layoutEngine && this.layoutEngine.add([questionElement]);
                  this.visibleElementsChanged(element);
                }
              );
              (addElementSelector &&
                toolbar.replaceChild(selectWrapper, addElementSelector)) ||
                toolbar.appendChild(selectWrapper);
              addElementSelector = selectWrapper;
            } else {
              addElementSelector && toolbar.removeChild(addElementSelector);
              addElementSelector = undefined;
            }
          };
          addElementSelectorUpdater(this, {});
          this.onVisibleElementsChanged.add(addElementSelectorUpdater);
        }
        return undefined;
      }
    );
  }

  public get allowDynamicLayout() {
    return (
      this.options.allowDynamicLayout === undefined ||
      this.options.allowDynamicLayout === true
    );
  }

  public get allowHideQuestions() {
    return (
      this.options.allowHideQuestions === undefined ||
      this.options.allowHideQuestions === true
    );
  }

  private getLayoutEngine: () => any;
  public get layoutEngine() {
    return !!this.getLayoutEngine && this.getLayoutEngine();
  }

  protected buildElements(questions: any[]): IVisualizerPanelElement[] {
    return (questions || []).map((question) => {
      return {
        name: question.name,
        displayName: question.title,
        visibility: ElementVisibility.Visible,
        type: undefined,
      };
    });
  }

  public getElements(): IVisualizerPanelElement[] {
    return (this._elements || []).map((element) => {
      return {
        name: element.name,
        displayName: element.displayName,
        visibility: element.visibility,
        type: element.type,
      };
    });
  }

  /**
   * Checks whether certain element is visible.
   */
  public isVisible(visibility: ElementVisibility) {
    return (
      (this.isTrustedAccess && visibility !== ElementVisibility.Invisible) ||
      (!this.isTrustedAccess && visibility === ElementVisibility.Visible)
    );
  }

  protected get visibleElements() {
    return this._elements.filter((el) => this.isVisible(el.visibility));
  }

  protected get hiddenElements() {
    return this._elements.filter((el) => !this.isVisible(el.visibility));
  }

  protected getElement(name: string) {
    return this._elements.filter((el) => el.name === name)[0];
  }

  /**
   * Fires when element visibility has been changed.
   */
  public onVisibleElementsChanged = new Event<
    (sender: VisualizationPanel, options: any) => any,
    any
  >();

  visibleElementsChanged(element: IVisualizerPanelElement) {
    if (!this.onVisibleElementsChanged.isEmpty) {
      this.onVisibleElementsChanged.fire(this, {
        elements: this._elements,
        changed: element,
      });
    }
    this.layout();
  }

  /**
   * Destroys given visualizer.
   */
  public destroyVisualizer(visualizer: VisualizerBase) {
    if (visualizer instanceof SelectBase) {
      visualizer.setSelection(undefined);
      visualizer.onDataItemSelected = undefined;
    }
    visualizer.onUpdate = undefined;
    visualizer.destroy();
    this.visualizers.splice(this.visualizers.indexOf(visualizer), 1);
  }

  /**
   * Renders given element.
   */
  public renderVisualizer(element: IVisualizerPanelElement) {
    var question = this.questions.filter((q) => q.name === element.name)[0];
    const questionElement = document.createElement("div");
    const questionContent = document.createElement("div");
    const titleElement = document.createElement("h3");
    const vizualizerElement = document.createElement("div");

    titleElement.innerText = element.displayName;

    questionElement.className = this.allowDynamicLayout
      ? questionElementClassName + " " + questionLayoutedElementClassName
      : questionElementClassName;
    titleElement.className = questionElementClassName + "__title";
    questionContent.className = questionElementClassName + "__content";

    questionContent.appendChild(titleElement);
    questionContent.appendChild(vizualizerElement);
    questionElement.appendChild(questionContent);

    const visualizer = VisualizerFactory.createVizualizer(
      question,
      this.filteredData
    );

    if (this.allowHideQuestions) {
      visualizer.registerToolbarItem(
        "removeQuestion",
        () => {
          return ToolbarHelper.createButton(
            () => {
              setTimeout(() => {
                element.visibility = ElementVisibility.Invisible;
                this.destroyVisualizer(visualizer);
                !!this.layoutEngine &&
                  this.layoutEngine.remove([questionElement]);
                this.contentContainer.removeChild(questionElement);
                this.visibleElementsChanged(element);
              }, 0);
            },
            localization.getString("hideButton")
          );
        }
      );
    }

    if (visualizer instanceof SelectBase) {
      var filterInfo = {
        text: <HTMLElement>undefined,
        element: <HTMLDivElement>undefined,
        update: function (selection: any) {
          if (!!selection && !!selection.value) {
            this.element.style.display = "inline-block";
            this.text.innerHTML = "Filter: [" + selection.text + "]";
          } else {
            this.element.style.display = "none";
            this.text.innerHTML = "";
          }
        },
      };

      visualizer.registerToolbarItem(
        "questionFilterInfo",
        () => {
          filterInfo.element = document.createElement("div");
          filterInfo.element.className = "sa-question__filter";

          filterInfo.text = document.createElement("span");
          filterInfo.text.className = "sa-question__filter-text";
          filterInfo.element.appendChild(filterInfo.text);

          const filterClear = ToolbarHelper.createButton(() => {
            visualizer.setSelection(undefined);
          }, localization.getString("clearButton"));
          filterInfo.element.appendChild(filterClear);

          filterInfo.update(visualizer.selection);

          return filterInfo.element;
        }
      );

      visualizer.onDataItemSelected = (
        selectedValue: any,
        selectedText: string
      ) => {
        filterInfo.update({ value: selectedValue, text: selectedText });
        this.setFilter(question.name, selectedValue);
      };
    }

    visualizer.render(vizualizerElement);
    visualizer.onUpdate = () => this.layout();
    this.visualizers.push(visualizer);

    return questionElement;
  }

  protected renderToolbar(container: HTMLElement) {
    container.className += " sa-panel__header";
    super.renderToolbar(container);
  }

  /**
   * Renders all questions into given HTML container element.
   * container - HTML element to render the panel
   */
  public renderContent(container: HTMLElement) {
    let layoutEngine: any = undefined;
    this.getLayoutEngine = () => layoutEngine;

    container.className += " sa-panel__content sa-grid";

    this.visibleElements.forEach((element) => {
      let questionElement = this.renderVisualizer(element);
      container.appendChild(questionElement);
    });

    var moveHandler = (data: any) => {
      var elements = this._elements.splice(data.fromIndex, 1);
      this._elements.splice(data.toIndex, 0, elements[0]);
    };

    if (this.allowDynamicLayout) {
      layoutEngine = new Muuri(container, {
        items: "." + questionLayoutedElementClassName,
        dragEnabled: true,
      });
      layoutEngine.on("move", moveHandler);
    }
    !!window && window.dispatchEvent(new UIEvent("resize"));
  }

  /**
   * Destroys visualizer and all inner content.
   */
  protected destroyContent(container: HTMLElement) {
    let layoutEngine = this.layoutEngine;
    if (!!layoutEngine) {
      layoutEngine.off("move");
      layoutEngine.destroy();
      this.getLayoutEngine = undefined;
    }
    this.visualizers.forEach((visualizer) => {
      visualizer.onUpdate = undefined;
      if (visualizer instanceof SelectBase) {
        visualizer.onDataItemSelected = undefined;
      }
      visualizer.destroy();
    });
    this.visualizers = [];
    super.destroyContent(container);
  }

  /**
   * Updates visualizer and all inner content.
   */
  update(data: Array<{ [index: string]: any }>) {
    super.update(data);
    this.applyFilter();
  }


  /**
   * Updates visualizer and all inner content.
   */
  public refresh(hard: boolean = false) {
    if (hard && this.visualizers.length > 0 && !!this.contentContainer) {
      this.destroyContent(this.contentContainer);
      this.renderContent(this.contentContainer);
    } else {
      this.visualizers.forEach((visualizer) =>
        setTimeout(() => visualizer.update(this.filteredData), 10)
      );
    }
  }

  /**
   * Updates layout of visualizer inner content.
   */
  public layout() {
    const layoutEngine = this.layoutEngine;
    if (!!layoutEngine) {
      layoutEngine.refreshItems();
      layoutEngine.layout();
    }
  }

  /**
   * Sets filter by question name and value.
   */
  public setFilter(questionName: string, selectedValue: any) {
    var filterChanged = true;
    if (selectedValue !== undefined) {
      filterChanged = this.filterValues[questionName] !== selectedValue;
      this.filterValues[questionName] = selectedValue;
    } else {
      filterChanged = this.filterValues[questionName] !== undefined;
      delete this.filterValues[questionName];
    }
    if (filterChanged) {
      this.applyFilter();
    }
  }

  /**
   * Applies filter to the data and update visualizers.
   */
  public applyFilter() {
    this.filteredData = this.data.filter((item) => {
      return !Object.keys(this.filterValues).some(
        (key) => item[key] !== this.filterValues[key]
      );
    });
    this.refresh();
  }
}
