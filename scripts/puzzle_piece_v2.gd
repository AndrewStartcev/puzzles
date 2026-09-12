class_name PuzzlePieceV2
extends Node2D

signal locked_in_place(piece)

var target_position: Vector2 = Vector2.ZERO
var snap_distance: float = 42.0
var piece_id: int = -1
var locked: bool = false

var _dragging: bool = false
var _drag_offset: Vector2 = Vector2.ZERO
var _active_touch: int = -1
var _area: Area2D
var _visual: Polygon2D
var _shadow_soft: Polygon2D
var _shadow_near: Polygon2D
var _outer_line: Line2D
var _highlight_line: Line2D
var _display_scale: float = 1.0
var _base_z_index: int = 10


func setup(
	texture: Texture2D,
	polygon_points: PackedVector2Array,
	uv_points: PackedVector2Array,
	target: Vector2,
	display_scale: float,
	id: int,
	snap_distance_px: float
) -> void:
	piece_id = id
	target_position = target
	snap_distance = snap_distance_px
	_display_scale = display_scale
	scale = Vector2.ONE * display_scale
	z_index = _base_z_index

	_shadow_soft = Polygon2D.new()
	_shadow_soft.polygon = polygon_points
	_shadow_soft.color = Color(0.0, 0.0, 0.0, 0.12)
	_shadow_soft.position = Vector2(8.0, 10.0) / display_scale
	_shadow_soft.z_index = -3
	add_child(_shadow_soft)

	_shadow_near = Polygon2D.new()
	_shadow_near.polygon = polygon_points
	_shadow_near.color = Color(0.0, 0.0, 0.0, 0.23)
	_shadow_near.position = Vector2(3.0, 4.0) / display_scale
	_shadow_near.z_index = -2
	add_child(_shadow_near)

	_visual = Polygon2D.new()
	_visual.polygon = polygon_points
	_visual.uv = uv_points
	_visual.texture = texture
	_visual.antialiased = true
	add_child(_visual)

	_outer_line = Line2D.new()
	_outer_line.points = polygon_points
	_outer_line.closed = true
	_outer_line.width = 1.8 / display_scale
	_outer_line.default_color = Color(0.02, 0.025, 0.035, 0.48)
	_outer_line.antialiased = true
	_outer_line.joint_mode = Line2D.LINE_JOINT_ROUND
	_outer_line.z_index = 1
	add_child(_outer_line)

	_highlight_line = Line2D.new()
	_highlight_line.points = polygon_points
	_highlight_line.closed = true
	_highlight_line.width = 0.65 / display_scale
	_highlight_line.default_color = Color(1.0, 1.0, 1.0, 0.46)
	_highlight_line.antialiased = true
	_highlight_line.joint_mode = Line2D.LINE_JOINT_ROUND
	_highlight_line.z_index = 2
	add_child(_highlight_line)

	_area = Area2D.new()
	_area.input_pickable = true
	_area.collision_layer = 1
	_area.collision_mask = 0
	add_child(_area)

	var collision := CollisionPolygon2D.new()
	collision.polygon = polygon_points
	_area.add_child(collision)
	_area.input_event.connect(_on_area_input_event)

	set_process_input(false)
	_set_resting_visuals()


func place_scrambled(at_position: Vector2) -> void:
	locked = false
	_dragging = false
	global_position = at_position
	z_index = _base_z_index
	if is_instance_valid(_area):
		_area.input_pickable = true
	if is_instance_valid(_visual):
		_visual.modulate = Color.WHITE
	set_process_input(false)
	_set_resting_visuals()


func _on_area_input_event(viewport: Node, event: InputEvent, _shape_idx: int) -> void:
	if locked:
		return

	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			_start_drag(event.position, -1)
			viewport.set_input_as_handled()
	elif event is InputEventScreenTouch:
		if event.pressed:
			_start_drag(event.position, event.index)
			viewport.set_input_as_handled()


func _start_drag(pointer_position: Vector2, touch_index: int) -> void:
	_dragging = true
	_active_touch = touch_index
	_drag_offset = global_position - pointer_position
	z_index = 1000
	if is_instance_valid(_visual):
		_visual.modulate = Color(1.035, 1.035, 1.035, 1.0)
	_set_lifted_visuals()
	set_process_input(true)


func _input(event: InputEvent) -> void:
	if not _dragging:
		return

	if _active_touch < 0:
		if event is InputEventMouseMotion:
			global_position = event.position + _drag_offset
		elif event is InputEventMouseButton:
			if event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
				_finish_drag()
	else:
		if event is InputEventScreenDrag and event.index == _active_touch:
			global_position = event.position + _drag_offset
		elif event is InputEventScreenTouch:
			if event.index == _active_touch and not event.pressed:
				_finish_drag()


func _finish_drag() -> void:
	_dragging = false
	_active_touch = -1
	set_process_input(false)

	if global_position.distance_to(target_position) <= snap_distance:
		global_position = target_position
		locked = true
		z_index = _base_z_index
		if is_instance_valid(_area):
			_area.input_pickable = false
		if is_instance_valid(_visual):
			_visual.modulate = Color.WHITE
		_set_locked_visuals()
		locked_in_place.emit(self)
	else:
		z_index = _base_z_index
		if is_instance_valid(_visual):
			_visual.modulate = Color.WHITE
		_set_resting_visuals()


func _set_resting_visuals() -> void:
	if is_instance_valid(_shadow_soft):
		_shadow_soft.position = Vector2(8.0, 10.0) / _display_scale
		_shadow_soft.color = Color(0.0, 0.0, 0.0, 0.12)
	if is_instance_valid(_shadow_near):
		_shadow_near.position = Vector2(3.0, 4.0) / _display_scale
		_shadow_near.color = Color(0.0, 0.0, 0.0, 0.23)


func _set_lifted_visuals() -> void:
	if is_instance_valid(_shadow_soft):
		_shadow_soft.position = Vector2(14.0, 17.0) / _display_scale
		_shadow_soft.color = Color(0.0, 0.0, 0.0, 0.16)
	if is_instance_valid(_shadow_near):
		_shadow_near.position = Vector2(6.0, 8.0) / _display_scale
		_shadow_near.color = Color(0.0, 0.0, 0.0, 0.28)


func _set_locked_visuals() -> void:
	if is_instance_valid(_shadow_soft):
		_shadow_soft.position = Vector2(2.0, 2.5) / _display_scale
		_shadow_soft.color = Color(0.0, 0.0, 0.0, 0.055)
	if is_instance_valid(_shadow_near):
		_shadow_near.position = Vector2(1.0, 1.2) / _display_scale
		_shadow_near.color = Color(0.0, 0.0, 0.0, 0.11)
	if is_instance_valid(_outer_line):
		_outer_line.default_color = Color(0.02, 0.025, 0.035, 0.34)
	if is_instance_valid(_highlight_line):
		_highlight_line.default_color = Color(1.0, 1.0, 1.0, 0.30)
